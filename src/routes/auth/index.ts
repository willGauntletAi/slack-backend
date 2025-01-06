import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { findUserByEmailOrUsername, createUser, findUserByEmail } from '../../db/users';
import { createRefreshToken, findRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from '../../db/refresh-tokens';
import { jwtConfig } from '../../config/jwt';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type RefreshBody = z.infer<typeof refreshSchema>;

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, jwtConfig.JWT_SECRET, {
    expiresIn: jwtConfig.JWT_ACCESS_EXPIRATION,
  });

  const refreshToken = jwt.sign({ userId }, jwtConfig.JWT_SECRET, {
    expiresIn: jwtConfig.JWT_REFRESH_EXPIRATION,
  });

  return { accessToken, refreshToken };
}

function getExpirationDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7); // 7 days from now
  return date;
}

// POST /auth/register
const registerHandler: RequestHandler<{}, {}, RegisterBody> = async (req, res): Promise<void> => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await findUserByEmailOrUsername(email, username);

    if (existingUser) {
      res.status(400).json({
        error: 'User with this email or username already exists',
      });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await createUser({
      username,
      email,
      password_hash: passwordHash,
    });

    if (!user) {
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Store refresh token
    await createRefreshToken({
      user_id: user.id,
      token: tokens.refreshToken,
      expires_at: getExpirationDate(),
    });

    // Don't send password hash in response
    const { password_hash, ...userWithoutPassword } = user;
    res.status(201).json({
      user: userWithoutPassword,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/login
const loginHandler: RequestHandler<{}, {}, LoginBody> = async (req, res): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Store refresh token
    await createRefreshToken({
      user_id: user.id,
      token: tokens.refreshToken,
      expires_at: getExpirationDate(),
    });

    // Don't send password hash in response
    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/refresh
const refreshHandler: RequestHandler<{}, {}, RefreshBody> = async (req, res): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify token exists and is not revoked
    const tokenDoc = await findRefreshToken(refreshToken);
    if (!tokenDoc || tokenDoc.revoked_at || new Date(tokenDoc.expires_at) < new Date()) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Verify token is valid
    const decoded = jwt.verify(refreshToken, jwtConfig.JWT_SECRET) as { userId: string };

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    // Revoke old refresh token
    await revokeRefreshToken(refreshToken);

    // Store new refresh token
    await createRefreshToken({
      user_id: decoded.userId,
      token: tokens.refreshToken,
      expires_at: getExpirationDate(),
    });

    res.json(tokens);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/logout
const logoutHandler: RequestHandler = async (req: AuthRequest, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const refreshToken = authHeader.split(' ')[1];
      await revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/logout-all
const logoutAllHandler: RequestHandler = async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    await revokeAllUserRefreshTokens(req.user.id);
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', authenticate, logoutHandler);
router.post('/logout-all', authenticate, logoutAllHandler);

export default router; 
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { findUserByEmailOrUsername, createUser, findUserByEmail } from '../../db/users';
import { createRefreshToken, findRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from '../../db/refresh-tokens';
import { jwtConfig } from '../../config/jwt';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  RegisterResponseSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
  LogoutResponseSchema,
  LogoutAllResponseSchema,
  ErrorResponseSchema,
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  RegisterResponse,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  LogoutAllResponse,
  ErrorResponse,
} from './types';

const router = Router();

type RegisterBody = RegisterRequest;
type LoginBody = LoginRequest;
type RefreshBody = RefreshRequest;

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
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['auth'],
  summary: 'Register a new user account',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    '201': {
      description: 'User registered successfully',
      content: {
        'application/json': {
          schema: RegisterResponseSchema.openapi('RegisterResponse'),
        },
      },
    },
    '400': {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const registerHandler: RequestHandler<{}, RegisterResponse | ErrorResponse, RegisterBody> = async (req, res): Promise<void> => {
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

    const response: RegisterResponse = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/login
registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['auth'],
  summary: 'Login with email and password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema
        }
      }
    }
  },
  responses: {
    '200': {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: LoginResponseSchema.openapi('LoginResponse'),
        },
      },
    },
    '401': {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const loginHandler: RequestHandler<{}, LoginResponse | ErrorResponse, LoginBody> = async (req, res): Promise<void> => {
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

    const response: LoginResponse = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/refresh
registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['auth'],
  summary: 'Refresh access token using refresh token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: refreshSchema
        }
      }
    }
  },
  responses: {
    '200': {
      description: 'Token refresh successful',
      content: {
        'application/json': {
          schema: RefreshResponseSchema.openapi('RefreshResponse'),
        },
      },
    },
    '401': {
      description: 'Invalid refresh token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const refreshHandler: RequestHandler<{}, RefreshResponse | ErrorResponse, RefreshBody> = async (req, res): Promise<void> => {
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

    const response: RefreshResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
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
registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['auth'],
  summary: 'Logout and revoke refresh token',
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: LogoutResponseSchema.openapi('LogoutResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const logoutHandler: RequestHandler<{}, LogoutResponse | ErrorResponse> = async (req: AuthRequest, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const refreshToken = authHeader.split(' ')[1];
      await revokeRefreshToken(refreshToken);
    }
    const response: LogoutResponse = { message: 'Logged out successfully' };
    res.json(response);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/logout-all
registry.registerPath({
  method: 'post',
  path: '/auth/logout-all',
  tags: ['auth'],
  summary: 'Logout from all devices and revoke all refresh tokens',
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'Logged out from all devices',
      content: {
        'application/json': {
          schema: LogoutAllResponseSchema.openapi('LogoutAllResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const logoutAllHandler: RequestHandler<{}, LogoutAllResponse | ErrorResponse> = async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    await revokeAllUserRefreshTokens(req.user.id);
    const response: LogoutAllResponse = { message: 'Logged out from all devices' };
    res.json(response);
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
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';

export interface TokenPayload {
  userId: string;
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, jwtConfig.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
} 
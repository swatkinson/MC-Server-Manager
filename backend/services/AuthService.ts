import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { config } from '../config.js';
import type { PublicUser, TokenPayload } from '../types/index.js';

const BCRYPT_COST = 12;
export const JWT_EXPIRY_SECONDS = 8 * 60 * 60;
export const COOKIE_NAME = 'mc_auth';

export class AuthService {
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  signToken(user: PublicUser): string {
    return jwt.sign({ username: user.username, role: user.role }, config.jwtSecret, {
      subject: user.id,
      expiresIn: JWT_EXPIRY_SECONDS,
    });
  }

  verifyToken(token: string): { valid: true; payload: TokenPayload } | { valid: false } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (typeof decoded === 'string') return { valid: false };
      return { valid: true, payload: decoded as TokenPayload };
    } catch {
      return { valid: false };
    }
  }

  cookieOptions(secure: boolean): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      path: '/',
      maxAge: JWT_EXPIRY_SECONDS * 1000,
    };
  }
}

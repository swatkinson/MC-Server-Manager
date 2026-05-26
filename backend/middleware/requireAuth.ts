import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../services/AuthService.js';
import { COOKIE_NAME } from '../services/AuthService.js';
import type { TokenPayload } from '../types/index.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export function requireAuth(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies[COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = authService.verifyToken(token);
    if (!result.valid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = result.payload;
    next();
  };
}

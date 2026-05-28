import { Request, Response, NextFunction } from 'express';

export function fail(res: Response, status: number, message: string, error?: unknown): void {
  if (error) console.error(message, error);
  res.status(status).json({ error: message });
}

export const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

export function isValidUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(u);
}

export function isValidPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}

export const VALID_ROLES = new Set<string>(['admin', 'moderator', 'user']);

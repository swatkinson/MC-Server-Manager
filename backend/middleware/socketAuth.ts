import type { Socket } from 'socket.io';
import type { AuthService } from '../services/AuthService.js';
import { COOKIE_NAME } from '../services/AuthService.js';
import type { TokenPayload } from '../types/index.js';

function parseCookieHeader(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return undefined;
}

export function socketAuthMiddleware(authService: AuthService) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const raw = socket.handshake.headers.cookie ?? '';
    const token = parseCookieHeader(raw, COOKIE_NAME);
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }
    const result = authService.verifyToken(token);
    if (!result.valid) {
      next(new Error('Unauthorized'));
      return;
    }
    (socket.data as { user: TokenPayload }).user = result.payload;
    next();
  };
}

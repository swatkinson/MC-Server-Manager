import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { COOKIE_NAME } from '../services/AuthService.js';
import type { UserStore } from '../services/UserStore.js';
import type { AuthService } from '../services/AuthService.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import { fail, asyncRoute, isValidUsername, isValidPassword, VALID_ROLES } from './utils.js';

export function createAuthRouter(
  userStore: UserStore,
  authService: AuthService,
  auditLogger: AuditLogger,
): Router {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts, try again later' },
  });

  const setupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many setup attempts, try again later' },
  });

  // Public routes
  router.get(
    '/api/auth/setup',
    asyncRoute(async (_req, res) => {
      const setupRequired = await userStore.isEmpty();
      res.json({ setupRequired });
    }),
  );

  router.post(
    '/api/auth/setup',
    setupLimiter,
    asyncRoute(async (req, res) => {
      if (!(await userStore.isEmpty())) {
        res.status(403).json({ error: 'Setup already completed' });
        return;
      }
      const { username, password } = req.body ?? {};
      if (!isValidUsername(username)) {
        fail(res, 400, 'Username must be 3–32 characters (letters, numbers, underscore)');
        return;
      }
      if (!isValidPassword(password)) {
        fail(res, 400, 'Password must be 8–128 characters');
        return;
      }
      const hash = await authService.hashPassword(password as string);
      const user = await userStore.create(username as string, hash, 'admin');
      const token = authService.signToken(user);
      res.cookie(COOKIE_NAME, token, authService.cookieOptions(req.secure));
      res.status(201).json({ user: { id: user.id, username: user.username, role: user.role } });
    }),
  );

  router.post(
    '/api/auth/login',
    loginLimiter,
    asyncRoute(async (req, res) => {
      const { username, password } = req.body ?? {};
      if (typeof username !== 'string' || typeof password !== 'string') {
        fail(res, 400, 'Username and password are required');
        return;
      }
      const user = await userStore.getByUsername(username);
      if (!user || !(await authService.verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const token = authService.signToken(user);
      res.cookie(COOKIE_NAME, token, authService.cookieOptions(req.secure));
      void auditLogger.log({ sub: user.id, username: user.username, role: user.role }, 'auth.login');
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    }),
  );

  router.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (token) {
      const result = authService.verifyToken(token);
      const logUser = result.valid ? result.payload : null;
      void auditLogger.log(logUser, 'auth.logout');
    }
    res.clearCookie(COOKIE_NAME, authService.cookieOptions(req.secure));
    res.json({ ok: true });
  });

  // Protected routes
  router.get(
    '/api/auth/me',
    requireAuth(authService),
    asyncRoute(async (req, res) => {
      res.json({ user: req.user });
    }),
  );

  router.get(
    '/api/auth/users',
    requireAuth(authService),
    requireRole('admin'),
    asyncRoute(async (_req, res) => {
      const users = await userStore.getAll();
      res.json({
        users: users.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })),
      });
    }),
  );

  router.post(
    '/api/auth/users',
    requireAuth(authService),
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const { username, password, role: rawRole } = req.body ?? {};
      if (!isValidUsername(username)) {
        fail(res, 400, 'Username must be 3–32 characters (letters, numbers, underscore)');
        return;
      }
      if (!isValidPassword(password)) {
        fail(res, 400, 'Password must be 8–128 characters');
        return;
      }
      const role: 'admin' | 'moderator' | 'user' =
        typeof rawRole === 'string' && VALID_ROLES.has(rawRole)
          ? (rawRole as 'admin' | 'moderator' | 'user')
          : 'user';
      const existing = await userStore.getByUsername(username as string);
      if (existing) {
        fail(res, 409, 'Username already taken');
        return;
      }
      const hash = await authService.hashPassword(password as string);
      const user = await userStore.create(username as string, hash, role);
      void auditLogger.log(req.user ?? null, 'auth.user.create', { username: user.username, role: user.role });
      res.status(201).json({ user: { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt } });
    }),
  );

  router.delete(
    '/api/auth/users/:id',
    requireAuth(authService),
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (req.user?.sub === id) {
        fail(res, 400, 'Cannot delete your own account');
        return;
      }
      const targetUser = await userStore.getById(id);
      const deleted = await userStore.delete(id);
      if (!deleted) {
        fail(res, 404, 'User not found');
        return;
      }
      void auditLogger.log(req.user ?? null, 'auth.user.delete', { deletedUsername: targetUser?.username ?? id });
      res.json({ ok: true });
    }),
  );

  return router;
}

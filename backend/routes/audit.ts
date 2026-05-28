import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createAuditRouter(
  auditLogger: AuditLogger,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/audit',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 25, 200);
      const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
      try {
        const result = await auditLogger.getEntries(limit, offset);
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to get audit log', error);
      }
    }),
  );

  return router;
}

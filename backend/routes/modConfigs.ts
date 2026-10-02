import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { ConfigError } from '../services/ModConfigService.js';
import type { ModConfigService } from '../services/ModConfigService.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

function handleError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ConfigError) fail(res, error.status, error.message);
  else fail(res, 500, fallback, error);
}

// File locations travel as query params (?root=config&path=foo/bar.toml) so
// nested paths don't fight Express route matching.
export function createModConfigsRouter(
  service: ModConfigService,
  auditLogger: AuditLogger,
  authService: AuthService,
): Router {
  const router = Router();
  router.use('/api/mod-configs', requireAuth(authService), requireRole('admin', 'moderator'));

  const loc = (q: Record<string, unknown>) => ({ root: String(q.root ?? ''), path: String(q.path ?? '') });

  router.get(
    '/api/mod-configs',
    asyncRoute(async (_req, res) => {
      try {
        res.json({ roots: await service.listRoots() });
      } catch (error) {
        handleError(res, error, 'Failed to list config files');
      }
    }),
  );

  router.get(
    '/api/mod-configs/file',
    asyncRoute(async (req, res) => {
      const { root, path } = loc(req.query);
      try {
        res.json(await service.read(root, path));
      } catch (error) {
        handleError(res, error, 'Failed to read file');
      }
    }),
  );

  router.put(
    '/api/mod-configs/file',
    asyncRoute(async (req, res) => {
      const { root, path } = loc(req.query);
      const { content, mtimeMs } = req.body ?? {};
      if (typeof content !== 'string' || typeof mtimeMs !== 'number') {
        fail(res, 400, 'content and mtimeMs are required');
        return;
      }
      try {
        const result = await service.write(root, path, content, mtimeMs);
        void auditLogger.log(req.user ?? null, 'modconfig.save', { root, path });
        res.json(result);
      } catch (error) {
        handleError(res, error, 'Failed to save file');
      }
    }),
  );

  router.get(
    '/api/mod-configs/versions',
    asyncRoute(async (req, res) => {
      const { root, path } = loc(req.query);
      try {
        const version = typeof req.query.version === 'string' ? req.query.version : null;
        if (version) res.json({ content: await service.readVersion(root, path, version) });
        else res.json({ versions: await service.listVersions(root, path) });
      } catch (error) {
        handleError(res, error, 'Failed to read versions');
      }
    }),
  );

  return router;
}

import { Router } from 'express';
import { runPreflightChecks } from '../services/PreflightChecker.js';
import { fail, asyncRoute } from './utils.js';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get(
    '/api/health/preflight',
    asyncRoute(async (_req, res) => {
      try {
        const checks = await runPreflightChecks();
        res.json({ checks });
      } catch (error) {
        fail(res, 500, 'Failed to run preflight checks', error);
      }
    }),
  );

  return router;
}

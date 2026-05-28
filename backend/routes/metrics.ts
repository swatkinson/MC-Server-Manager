import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import type { MetricsCollector } from '../services/MetricsCollector.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createMetricsRouter(
  metricsCollector: MetricsCollector,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/metrics',
    asyncRoute(async (_req, res) => {
      try {
        res.json(await metricsCollector.getMetrics());
      } catch (error) {
        fail(res, 500, 'Failed to get metrics', error);
      }
    }),
  );

  return router;
}

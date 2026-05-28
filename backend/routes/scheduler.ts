import { Router } from 'express';
import { Server } from 'socket.io';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { RestartScheduler } from '../services/RestartScheduler.js';
import type { ServerManager } from '../services/ServerManager.js';
import type { PortForwardChecker } from '../services/PortForwardChecker.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createSchedulerRouter(
  restartScheduler: RestartScheduler,
  serverManager: ServerManager,
  portForwardChecker: PortForwardChecker,
  authService: AuthService,
  io: Server,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/scheduler/restart',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      res.json({ schedule: restartScheduler.getSchedule() });
    }),
  );

  router.post(
    '/api/scheduler/restart',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const result = await restartScheduler.setSchedule(req.body ?? {});
      res.status(result.success ? 200 : 400).json(result);
    }),
  );

  router.post(
    '/api/scheduler/restart/now',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      try {
        const result = await serverManager.restart();
        io.emit('server:status:changed', result);
        if (result.success) {
          portForwardChecker.scheduleStartupCheck((checkResult) => {
            io.emit('portforward:result', checkResult);
          });
        }
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to restart server', error);
      }
    }),
  );

  return router;
}

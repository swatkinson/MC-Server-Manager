import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { isValidCommand } from '../services/ConsoleManager.js';
import type { ConsoleManager } from '../services/ConsoleManager.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createConsoleRouter(
  consoleManager: ConsoleManager,
  auditLogger: AuditLogger,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/console/logs',
    asyncRoute(async (req, res) => {
      try {
        const requested = parseInt(req.query.limit as string, 10);
        const limit = Number.isFinite(requested) ? requested : 50;
        const logs = await consoleManager.getLogs(limit);
        res.json({ logs });
      } catch (error) {
        fail(res, 500, 'Failed to get console logs', error);
      }
    }),
  );

  router.post(
    '/api/console/command',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const { command } = req.body ?? {};
      if (!command || typeof command !== 'string') {
        fail(res, 400, 'Command is required');
        return;
      }
      if (!isValidCommand(command)) {
        fail(res, 400, 'Command contains invalid characters');
        return;
      }
      try {
        await consoleManager.executeCommand(command);
        void auditLogger.log(req.user ?? null, 'console.command', { command });
        res.json({ success: true });
      } catch (error) {
        fail(res, 500, 'Failed to execute command', error);
      }
    }),
  );

  return router;
}

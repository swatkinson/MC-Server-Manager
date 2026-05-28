import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { DiscordNotifier } from '../services/DiscordNotifier.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createWebhooksRouter(
  discordNotifier: DiscordNotifier,
  auditLogger: AuditLogger,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/webhooks/config',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      try {
        const webhookConfig = await discordNotifier.getConfig();
        res.json({ config: webhookConfig });
      } catch (error) {
        fail(res, 500, 'Failed to get webhook config', error);
      }
    }),
  );

  router.put(
    '/api/webhooks/config',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      try {
        await discordNotifier.setConfig(req.body ?? {});
        void auditLogger.log(req.user ?? null, 'webhooks.config');
        res.json({ success: true });
      } catch (error) {
        fail(res, 500, 'Failed to save webhook config', error);
      }
    }),
  );

  router.post(
    '/api/webhooks/test',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      try {
        const result = await discordNotifier.testWebhook();
        void auditLogger.log(req.user ?? null, 'webhooks.test', { success: result.success });
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to test webhook', error);
      }
    }),
  );

  return router;
}

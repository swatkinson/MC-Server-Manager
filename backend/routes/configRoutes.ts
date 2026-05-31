import { Router } from 'express';
import { Server } from 'socket.io';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { isValidUuid } from '../services/ConfigManager.js';
import type { ConfigManager } from '../services/ConfigManager.js';
import type { StartupScriptManager } from '../services/StartupScriptManager.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createConfigRouter(
  configManager: ConfigManager,
  startupScriptManager: StartupScriptManager,
  auditLogger: AuditLogger,
  authService: AuthService,
  io: Server,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/config/server-properties',
    asyncRoute(async (_req, res) => {
      try {
        res.json(await configManager.getServerProperties());
      } catch (error) {
        fail(res, 500, 'Failed to get server properties', error);
      }
    }),
  );

  router.post(
    '/api/config/server-properties',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const { properties } = req.body ?? {};
      if (!properties || typeof properties !== 'object') {
        fail(res, 400, 'Properties object is required');
        return;
      }
      try {
        const result = await configManager.setServerProperties(properties);
        if (result.success) {
          io.emit('config:updated', properties);
          void auditLogger.log(req.user ?? null, 'config.serverProperties', { keys: Object.keys(properties as Record<string, unknown>) });
        }
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to update server properties', error);
      }
    }),
  );

  router.get(
    '/api/config/whitelist',
    asyncRoute(async (_req, res) => {
      try {
        const [entries, enabled] = await Promise.all([
          configManager.getWhitelist(),
          configManager.isWhitelistEnabled(),
        ]);
        res.json({ entries, enabled });
      } catch (error) {
        fail(res, 500, 'Failed to get whitelist', error);
      }
    }),
  );

  router.post(
    '/api/config/whitelist',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const { uuid, name, entries, enabled } = req.body ?? {};
      try {
        let result;
        if (Array.isArray(entries)) {
          result = await configManager.setWhitelist(entries);
        } else if (enabled !== undefined) {
          result = await configManager.setWhitelistEnabled(Boolean(enabled));
        } else {
          result = await configManager.addToWhitelist(uuid, name);
        }

        if (result.success) {
          const updatedEntries = await configManager.getWhitelist();
          const updatedEnabled = await configManager.isWhitelistEnabled();
          io.emit('whitelist:updated', { entries: updatedEntries, enabled: updatedEnabled });
          if (Array.isArray(entries)) {
            void auditLogger.log(req.user ?? null, 'config.whitelist.set', { count: (entries as unknown[]).length });
          } else if (enabled !== undefined) {
            void auditLogger.log(req.user ?? null, 'config.whitelist.toggle', { enabled: Boolean(enabled) });
          } else {
            void auditLogger.log(req.user ?? null, 'config.whitelist.add', { name: name as string });
          }
        }
        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        fail(res, 500, 'Failed to update whitelist', error);
      }
    }),
  );

  router.delete(
    '/api/config/whitelist/:uuid',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const rawUuid = req.params.uuid;
      const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid;
      if (typeof uuid !== 'string' || !isValidUuid(uuid)) {
        fail(res, 400, 'Invalid UUID format');
        return;
      }
      try {
        const result = await configManager.removeFromWhitelist(uuid);
        if (result.success) {
          const updatedEntries = await configManager.getWhitelist();
          const updatedEnabled = await configManager.isWhitelistEnabled();
          io.emit('whitelist:updated', { entries: updatedEntries, enabled: updatedEnabled });
          void auditLogger.log(req.user ?? null, 'config.whitelist.remove', { uuid });
        }
        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        fail(res, 500, 'Failed to remove from whitelist', error);
      }
    }),
  );

  router.get(
    '/api/config/startup-script',
    asyncRoute(async (_req, res) => {
      try {
        res.json(await startupScriptManager.read());
      } catch (error) {
        fail(res, 500, 'Failed to read startup script', error);
      }
    }),
  );

  router.post(
    '/api/config/startup-script',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const { xms, xmx, jar, extraFlags } = req.body ?? {};
      try {
        await startupScriptManager.write({
          xms: typeof xms === 'string' ? xms.trim() : '',
          xmx: typeof xmx === 'string' ? xmx.trim() : '',
          jar: typeof jar === 'string' ? jar.trim() : '',
          extraFlags: typeof extraFlags === 'string' ? extraFlags.trim() : '',
        });
        void auditLogger.log(req.user ?? null, 'config.jvm', { xms, xmx, jar });
        res.json({ success: true });
      } catch (error) {
        fail(res, 500, 'Failed to write startup script', error);
      }
    }),
  );

  return router;
}

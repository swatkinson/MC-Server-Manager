import { Router } from 'express';
import fs from 'fs';
import archiver from 'archiver';
import { Server } from 'socket.io';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { ServerManager } from '../services/ServerManager.js';
import type { PortForwardChecker } from '../services/PortForwardChecker.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { DiscordNotifier } from '../services/DiscordNotifier.js';
import type { PlayerManager } from '../services/PlayerManager.js';
import type { ConfigManager } from '../services/ConfigManager.js';
import type { AuthService } from '../services/AuthService.js';
import type { ServerInfoStore } from '../services/ServerInfoStore.js';
import { fail, asyncRoute } from './utils.js';

export function createServerRouter(
  serverManager: ServerManager,
  portForwardChecker: PortForwardChecker,
  auditLogger: AuditLogger,
  discordNotifier: DiscordNotifier,
  playerManager: PlayerManager,
  configManager: ConfigManager,
  authService: AuthService,
  io: Server,
  infoStore: ServerInfoStore,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/server/status',
    asyncRoute(async (_req, res) => {
      try {
        res.json(await serverManager.getStatus());
      } catch (error) {
        fail(res, 500, 'Failed to get server status', error);
      }
    }),
  );

  router.post(
    '/api/server/start',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      try {
        const result = await serverManager.start();
        io.emit('server:status:changed', result);
        if (result.success) {
          void auditLogger.log(req.user ?? null, 'server.start');
          void discordNotifier.onServerStart();
          portForwardChecker.scheduleStartupCheck((checkResult) => {
            io.emit('portforward:result', checkResult);
          });
        }
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to start server', error);
      }
    }),
  );

  router.post(
    '/api/server/stop',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      try {
        const result = await serverManager.stop();
        if (result.success) {
          playerManager.clearAll();
          void auditLogger.log(req.user ?? null, 'server.stop');
          void discordNotifier.onServerStop();
        }
        portForwardChecker.cancelStartupCheck();
        io.emit('server:status:changed', result);
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to stop server', error);
      }
    }),
  );

  router.post(
    '/api/server/restart',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      try {
        const result = await serverManager.restart();
        io.emit('server:status:changed', result);
        if (result.success) {
          void auditLogger.log(req.user ?? null, 'server.restart');
          void discordNotifier.onRestartComplete();
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

  router.get(
    '/api/server/portforward/check',
    asyncRoute(async (_req, res) => {
      try {
        const result = await portForwardChecker.check();
        io.emit('portforward:result', result);
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to run port-forward check', error);
      }
    }),
  );

  router.get(
    '/api/server/public-ip',
    asyncRoute(async (_req, res) => {
      try {
        const publicIp = await portForwardChecker.getPublicIp();
        res.json({ publicIp });
      } catch (error) {
        fail(res, 500, 'Failed to get public IP', error);
      }
    }),
  );

  router.get(
    '/api/server/info',
    asyncRoute(async (_req, res) => {
      try {
        const info = (await infoStore.read()) ?? { version: 'unknown', serverType: 'unknown', updatedAt: 0 };
        res.json(info);
      } catch (error) {
        fail(res, 500, 'Failed to get server info', error);
      }
    }),
  );

  router.post(
    '/api/server/world-backup',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      const worldPath = await configManager.getWorldPath();

      if (!fs.existsSync(worldPath)) {
        fail(res, 400, 'World directory not found');
        return;
      }

      res.setHeader('Content-Type', 'application/gzip');
      const date = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Disposition', `attachment; filename="world-backup-${date}.tar.gz"`);

      const archive = archiver('tar', { gzip: true });

      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create backup archive' });
        } else {
          res.end();
        }
      });

      archive.pipe(res);
      archive.directory(worldPath, 'world');

      try {
        await archive.finalize();
      } catch (error) {
        console.error('World backup error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to create world backup' });
      }
    }),
  );

  return router;
}

import { Router } from 'express';
import { Server } from 'socket.io';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { BackupService } from '../services/BackupService.js';
import type { ServerManager } from '../services/ServerManager.js';
import type { ConfigManager } from '../services/ConfigManager.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createBackupsRouter(
  backupService: BackupService,
  serverManager: ServerManager,
  configManager: ConfigManager,
  auditLogger: AuditLogger,
  authService: AuthService,
  io: Server,
): Router {
  const router = Router();

  router.use('/api/backups', requireAuth(authService));

  const param = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value ?? '');

  router.get(
    '/api/backups',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      res.json(await backupService.getStatus());
    }),
  );

  router.post(
    '/api/backups/run',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const result = await backupService.runBackup();
      if (result.success) {
        void auditLogger.log(req.user ?? null, 'backup.run');
        io.emit('backups:updated', await backupService.getStatus());
      }
      res.status(result.success ? 200 : 409).json(result);
    }),
  );

  router.get(
    '/api/backups/:filename/download',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      const filename = param(req.params.filename);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '')}"`);
      try {
        await backupService.streamArchive(filename, res);
        void auditLogger.log(req.user ?? null, 'backup.download', { filename });
      } catch (error) {
        if (!res.headersSent) {
          res.removeHeader('Content-Disposition');
          fail(res, 400, error instanceof Error ? error.message : 'Download failed', error);
        } else res.end();
      }
    }),
  );

  router.post(
    '/api/backups/:filename/restore',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const filename = param(req.params.filename);
      const [worldPath, running] = await Promise.all([configManager.getWorldPath(), serverManager.isRunning()]);
      const result = await backupService.restore(filename, worldPath, running);
      if (result.success) void auditLogger.log(req.user ?? null, 'backup.restore', { filename, keptAs: result.keptAs });
      res.status(result.success ? 200 : 409).json(result);
    }),
  );

  router.get(
    '/api/backups/config',
    requireRole('admin'),
    asyncRoute(async (_req, res) => {
      res.json(await backupService.getConfig());
    }),
  );

  router.put(
    '/api/backups/config',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      try {
        const saved = await backupService.setConfig(req.body ?? {});
        void auditLogger.log(req.user ?? null, 'backup.config', { host: saved.host });
        res.json(saved);
      } catch (error) {
        fail(res, 400, error instanceof Error ? error.message : 'Invalid backup config');
      }
    }),
  );

  return router;
}

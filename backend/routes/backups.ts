import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import type { BackupService } from '../services/BackupService.js';
import type { AuditLogger } from '../services/AuditLogger.js';
import type { AuthService } from '../services/AuthService.js';
import { fail, asyncRoute } from './utils.js';

export function createBackupsRouter(
  backupService: BackupService,
  auditLogger: AuditLogger,
  authService: AuthService,
): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get(
    '/api/backups/config',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      try {
        const backupConfig = await backupService.getConfig();
        res.json({ config: backupConfig });
      } catch (error) {
        fail(res, 500, 'Failed to get backup config', error);
      }
    }),
  );

  router.put(
    '/api/backups/config',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      try {
        await backupService.setConfig(req.body ?? {});
        void auditLogger.log(req.user ?? null, 'backup.config');
        res.json({ success: true });
      } catch (error) {
        fail(res, 500, 'Failed to save backup config', error);
      }
    }),
  );

  router.get(
    '/api/backups',
    requireRole('admin', 'moderator'),
    asyncRoute(async (_req, res) => {
      try {
        const backups = await backupService.listBackups();
        res.json({ backups });
      } catch (error) {
        fail(res, 500, 'Failed to list backups', error);
      }
    }),
  );

  router.post(
    '/api/backups',
    requireRole('admin', 'moderator'),
    asyncRoute(async (req, res) => {
      try {
        const result = await backupService.createBackup();
        if (result.success) void auditLogger.log(req.user ?? null, 'backup.create', { filename: result.filename });
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to create backup', error);
      }
    }),
  );

  router.post(
    '/api/backups/:filename/restore',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
      try {
        const result = await backupService.restoreBackup(filename);
        if (result.success) void auditLogger.log(req.user ?? null, 'backup.restore', { filename });
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to restore backup', error);
      }
    }),
  );

  router.delete(
    '/api/backups/:filename',
    requireRole('admin'),
    asyncRoute(async (req, res) => {
      const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
      try {
        const result = await backupService.deleteBackup(filename);
        if (result.success) void auditLogger.log(req.user ?? null, 'backup.delete', { filename });
        res.json(result);
      } catch (error) {
        fail(res, 500, 'Failed to delete backup', error);
      }
    }),
  );

  return router;
}

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface BackupConfig {
  backupDir: string;
  schedule: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  keepCount: number;
}

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: number; // Unix ms (from file mtime)
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  sizeBytes?: number;
  error?: string;
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function computeNext(hour: number, minute: number): Date {
  const now = new Date();
  const candidate = new Date();
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

const FILENAME_PATTERN = /^mc-backup-[\d_-]+\.tar\.gz$/;

export class BackupService {
  private config: BackupConfig | null = null;
  private backupTimer: NodeJS.Timeout | null = null;

  onBackupComplete: ((info: BackupInfo) => void) | null = null;
  onBackupFailed: ((error: string) => void) | null = null;

  constructor(
    private readonly configPath: string,
    private readonly minecraftDir: string,
    private readonly defaultBackupDir: string,
  ) {}

  async init(): Promise<void> {
    await this.loadConfig();

    const cfg = this.config!;
    if (!cfg.schedule.enabled) return;

    const next = computeNext(cfg.schedule.hour, cfg.schedule.minute);
    this.armTimer(next.getTime() - Date.now());
  }

  stop(): void {
    this.clearTimer();
  }

  async getConfig(): Promise<BackupConfig> {
    await this.loadConfig();
    return { ...this.config! };
  }

  async setConfig(partial: Partial<BackupConfig>): Promise<void> {
    await this.loadConfig();
    const current = this.config!;

    const merged: BackupConfig = {
      backupDir: partial.backupDir ?? current.backupDir,
      schedule: partial.schedule
        ? {
            enabled: partial.schedule.enabled ?? current.schedule.enabled,
            hour: Math.min(23, Math.max(0, Math.round(partial.schedule.hour ?? current.schedule.hour))),
            minute: Math.min(59, Math.max(0, Math.round(partial.schedule.minute ?? current.schedule.minute))),
          }
        : current.schedule,
      keepCount: Math.max(1, Math.round(partial.keepCount ?? current.keepCount)),
    };

    this.config = merged;
    await this.persist();

    this.clearTimer();
    if (merged.schedule.enabled) {
      const next = computeNext(merged.schedule.hour, merged.schedule.minute);
      this.armTimer(next.getTime() - Date.now());
    }
  }

  async createBackup(): Promise<BackupResult> {
    try {
      const cfg = await this.getConfig();
      const backupsDir = path.join(cfg.backupDir, 'mc-backups');
      await fs.mkdir(backupsDir, { recursive: true });

      const timestamp = formatTimestamp();
      const filename = `mc-backup-${timestamp}.tar.gz`;
      const outputPath = path.join(backupsDir, filename);

      const parentOfMinecraftDir = path.dirname(this.minecraftDir);
      const minecraftDirName = path.basename(this.minecraftDir);

      // Exclude the backups dir from the archive when it lives inside minecraftDir,
      // otherwise each backup would embed all previous backups.
      const tarArgs = ['-czf', outputPath];
      const relBackupsDir = path.relative(this.minecraftDir, backupsDir);
      if (!relBackupsDir.startsWith('..') && !path.isAbsolute(relBackupsDir)) {
        tarArgs.push('--exclude', path.join(minecraftDirName, relBackupsDir));
      }
      tarArgs.push('-C', parentOfMinecraftDir, minecraftDirName);

      await execFileAsync('tar', tarArgs);

      const stat = await fs.stat(outputPath);
      const sizeBytes = stat.size;
      const createdAt = stat.mtimeMs;

      await this.enforceKeepCount(backupsDir, cfg.keepCount);

      const info: BackupInfo = { filename, sizeBytes, createdAt };
      this.onBackupComplete?.(info);

      return { success: true, filename, sizeBytes };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.onBackupFailed?.(message);
      return { success: false, error: message };
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      const cfg = await this.getConfig();
      const backupsDir = path.join(cfg.backupDir, 'mc-backups');

      let entries: string[];
      try {
        entries = await fs.readdir(backupsDir);
      } catch {
        return [];
      }

      const tarFiles = entries.filter((f) => f.endsWith('.tar.gz'));

      const infos = await Promise.all(
        tarFiles.map(async (filename): Promise<BackupInfo | null> => {
          try {
            const stat = await fs.stat(path.join(backupsDir, filename));
            return { filename, sizeBytes: stat.size, createdAt: stat.mtimeMs };
          } catch {
            return null;
          }
        }),
      );

      return infos
        .filter((i): i is BackupInfo => i !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  async restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    if (!FILENAME_PATTERN.test(filename)) {
      return { success: false, error: 'Invalid backup filename' };
    }

    try {
      const cfg = await this.getConfig();
      const backupsDir = path.join(cfg.backupDir, 'mc-backups');
      const backupFile = path.join(backupsDir, filename);

      try {
        await fs.access(backupFile);
      } catch {
        return { success: false, error: 'Backup file not found' };
      }

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-restore-'));

      try {
        await execFileAsync('tar', ['-xzf', backupFile, '-C', tempDir]);

        const minecraftDirName = path.basename(this.minecraftDir);
        const extractedDir = path.join(tempDir, minecraftDirName);

        try {
          await execFileAsync('rsync', [
            '-a',
            '--exclude=mc-server-manager/',
            `${extractedDir}/`,
            `${this.minecraftDir}/`,
          ]);
        } catch (rsyncErr) {
          const isEnoent =
            rsyncErr instanceof Error && 'code' in rsyncErr && (rsyncErr as NodeJS.ErrnoException).code === 'ENOENT';
          if (!isEnoent) throw rsyncErr;

          // rsync not available — manual copy fallback
          await this.manualCopy(extractedDir, this.minecraftDir);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async deleteBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    if (!FILENAME_PATTERN.test(filename)) {
      return { success: false, error: 'Invalid backup filename' };
    }

    try {
      const cfg = await this.getConfig();
      const backupsDir = path.join(cfg.backupDir, 'mc-backups');
      await fs.unlink(path.join(backupsDir, filename));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // --- Private helpers ---

  private async loadConfig(): Promise<void> {
    if (this.config !== null) return;

    const defaultConfig: BackupConfig = {
      backupDir: this.defaultBackupDir,
      schedule: { enabled: false, hour: 3, minute: 0 },
      keepCount: 7,
    };

    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<BackupConfig>;
      this.config = {
        backupDir: typeof parsed.backupDir === 'string' ? parsed.backupDir : defaultConfig.backupDir,
        schedule:
          parsed.schedule &&
          typeof parsed.schedule.enabled === 'boolean' &&
          typeof parsed.schedule.hour === 'number' &&
          typeof parsed.schedule.minute === 'number'
            ? {
                enabled: parsed.schedule.enabled,
                hour: parsed.schedule.hour,
                minute: parsed.schedule.minute,
              }
            : defaultConfig.schedule,
        keepCount: typeof parsed.keepCount === 'number' ? parsed.keepCount : defaultConfig.keepCount,
      };
    } catch {
      this.config = defaultConfig;
    }
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  private async enforceKeepCount(backupsDir: string, keepCount: number): Promise<void> {
    const backups = await this.listBackupsInDir(backupsDir);
    if (backups.length <= keepCount) return;

    // listBackupsInDir returns newest-first; delete from the end (oldest)
    const toDelete = backups.slice(keepCount);
    for (const info of toDelete) {
      try {
        await fs.unlink(path.join(backupsDir, info.filename));
      } catch {
        // best-effort
      }
    }
  }

  private async listBackupsInDir(backupsDir: string): Promise<BackupInfo[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(backupsDir);
    } catch {
      return [];
    }

    const tarFiles = entries.filter((f) => f.endsWith('.tar.gz'));

    const infos = await Promise.all(
      tarFiles.map(async (filename): Promise<BackupInfo | null> => {
        try {
          const stat = await fs.stat(path.join(backupsDir, filename));
          return { filename, sizeBytes: stat.size, createdAt: stat.mtimeMs };
        } catch {
          return null;
        }
      }),
    );

    return infos
      .filter((i): i is BackupInfo => i !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private async manualCopy(srcDir: string, destDir: string): Promise<void> {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'mc-server-manager') continue;
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.manualCopy(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private armTimer(msUntilBackup: number): void {
    this.backupTimer = setTimeout(() => {
      void this.executeScheduledBackup();
    }, Math.max(0, msUntilBackup));
  }

  private async executeScheduledBackup(): Promise<void> {
    await this.createBackup();
    await this.scheduleNext();
  }

  private async scheduleNext(): Promise<void> {
    // Reload config in case it changed
    this.config = null;
    await this.loadConfig();
    const cfg = this.config!;
    if (!cfg.schedule.enabled) return;

    const next = computeNext(cfg.schedule.hour, cfg.schedule.minute);
    this.armTimer(next.getTime() - Date.now());
  }

  private clearTimer(): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }
  }
}

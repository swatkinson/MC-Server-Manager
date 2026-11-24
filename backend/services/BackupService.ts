import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import type { Writable } from 'stream';
import type { BackupGatewayConfig, HostBackupStatus } from '../types/index.js';

const execFileAsync = promisify(execFile);

// Backups are owned by the Proxmox host's `mc-world-backup` job (world-only
// archives on the host's backup SSD, nightly timer, keep-N retention). The
// panel talks to it through a restricted SSH key whose authorized_keys entry
// forces `/usr/local/sbin/mc-backup-gateway <server>`, which only allows:
//   list | run | fetch <archive>
// Nothing is stored on the VM except the short-lived download during a restore.

const ARCHIVE_PATTERN = /^[a-z0-9_-]+-world-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.tar\.gz$/;
const RUN_POLL_MS = 5_000;
const RUN_TIMEOUT_MS = 20 * 60_000;
// Previous worlds moved aside by a restore; older ones are deleted.
const KEEP_PRE_RESTORE = 2;

export class BackupService {
  private config: BackupGatewayConfig | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private restoring = false;

  onStatusChanged: ((status: HostBackupStatus) => void) | null = null;
  onBackupComplete: ((filename: string, sizeBytes: number) => void) | null = null;

  constructor(
    private readonly configPath: string,
    private readonly defaults: BackupGatewayConfig,
  ) {}

  stop(): void {
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = null;
  }

  async getConfig(): Promise<BackupGatewayConfig> {
    if (this.config) return this.config;
    try {
      const parsed = JSON.parse(await fs.readFile(this.configPath, 'utf-8')) as Partial<BackupGatewayConfig>;
      this.config = {
        host: typeof parsed.host === 'string' ? parsed.host : this.defaults.host,
        keyPath: typeof parsed.keyPath === 'string' ? parsed.keyPath : this.defaults.keyPath,
      };
    } catch {
      this.config = { ...this.defaults };
    }
    return this.config;
  }

  async setConfig(partial: Partial<BackupGatewayConfig>): Promise<BackupGatewayConfig> {
    const current = await this.getConfig();
    const next: BackupGatewayConfig = {
      host: typeof partial.host === 'string' ? partial.host.trim() : current.host,
      keyPath: typeof partial.keyPath === 'string' ? partial.keyPath.trim() : current.keyPath,
    };
    if (next.host && !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(next.host)) {
      throw new Error('Host must look like user@hostname');
    }
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(next, null, 2), 'utf-8');
    this.config = next;
    return next;
  }

  async getStatus(): Promise<HostBackupStatus> {
    const cfg = await this.getConfig();
    if (!cfg.host) return emptyStatus(cfg, 'Backup host is not configured.');
    try {
      const { stdout } = await execFileAsync('ssh', [...this.sshArgs(cfg), 'list'], { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
      const parsed = JSON.parse(stdout) as Omit<HostBackupStatus, 'configured' | 'reachable' | 'error' | 'host' | 'restoring'>;
      return { ...parsed, configured: true, reachable: true, error: null, host: cfg.host, restoring: this.restoring };
    } catch (error) {
      return { ...emptyStatus(cfg, describeSshError(error)), configured: true };
    }
  }

  async runBackup(): Promise<{ success: boolean; error?: string }> {
    const cfg = await this.getConfig();
    if (!cfg.host) return { success: false, error: 'Backup host is not configured' };
    try {
      const requestedAt = Date.now();
      const { stdout } = await execFileAsync('ssh', [...this.sshArgs(cfg), 'run'], { timeout: 20_000 });
      const result = JSON.parse(stdout) as { started: boolean; reason?: string };
      if (!result.started) return { success: false, error: result.reason ?? 'Host refused to start a backup' };
      this.watchRun(requestedAt);
      return { success: true };
    } catch (error) {
      return { success: false, error: describeSshError(error) };
    }
  }

  // Streams an archive from the host straight into `out` (an HTTP response).
  async streamArchive(filename: string, out: Writable): Promise<void> {
    if (!ARCHIVE_PATTERN.test(filename)) throw new Error('Invalid backup filename');
    const cfg = await this.getConfig();
    const child = spawn('ssh', [...this.sshArgs(cfg), 'fetch', filename], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.stdout.pipe(out);
    // Client gave up mid-download — stop pulling from the host.
    out.on('close', () => child.kill());
    const exited = new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `fetch exited with ${code}`))));
    });
    // Resolve only once the destination has flushed everything (matters for files).
    const flushed = new Promise<void>((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });
    await Promise.all([exited, flushed]);
  }

  // Replaces the world directory with the one from `filename`. The server must
  // be stopped: restoring under a live server gets overwritten on next save.
  // The current world is kept as `<world>.pre-restore-<timestamp>`.
  async restore(filename: string, worldPath: string, serverRunning: boolean): Promise<{ success: boolean; error?: string; keptAs?: string }> {
    if (!ARCHIVE_PATTERN.test(filename)) return { success: false, error: 'Invalid backup filename' };
    if (serverRunning) return { success: false, error: 'Stop the server before restoring a backup' };
    if (this.restoring) return { success: false, error: 'A restore is already in progress' };

    this.restoring = true;
    const parent = path.dirname(worldPath);
    const worldName = path.basename(worldPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    // Staged next to the world so the final swap is a same-filesystem rename.
    const staging = await fs.mkdtemp(path.join(parent, '.restore-'));
    const archivePath = path.join(staging, filename);
    try {
      await this.streamArchive(filename, createWriteStream(archivePath));

      const { stdout: listing } = await execFileAsync('tar', ['-tzf', archivePath], { maxBuffer: 256 * 1024 * 1024 });
      const roots = new Set(listing.split('\n').filter(Boolean).map((p) => p.replace(/^\.\//, '').split('/')[0]));
      if (roots.size !== 1) return { success: false, error: 'Archive does not contain a single world folder' };
      const [root] = [...roots];

      await execFileAsync('tar', ['-xzf', archivePath, '-C', staging]);
      const extracted = path.join(staging, root);
      await fs.access(path.join(extracted, 'level.dat'));

      const keptAs = `${worldName}.pre-restore-${stamp}`;
      try {
        await fs.rename(worldPath, path.join(parent, keptAs));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await fs.rename(extracted, worldPath);
      await this.prunePreRestore(parent, worldName);
      return { success: true, keptAs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
      this.restoring = false;
    }
  }

  private async prunePreRestore(parent: string, worldName: string): Promise<void> {
    const prefix = `${worldName}.pre-restore-`;
    const old = (await fs.readdir(parent)).filter((n) => n.startsWith(prefix)).sort((a, b) => b.localeCompare(a));
    for (const name of old.slice(KEEP_PRE_RESTORE)) {
      await fs.rm(path.join(parent, name), { recursive: true, force: true });
    }
  }

  // Polls the host after a manual run until it reports a finished run that
  // started after our request, pushing status updates along the way.
  private watchRun(requestedAt: number): void {
    this.stop();
    const deadline = Date.now() + RUN_TIMEOUT_MS;
    const tick = async () => {
      const status = await this.getStatus();
      this.onStatusChanged?.(status);
      const run = status.lastRun;
      const finished = run && run.startedAt * 1000 >= requestedAt - 60_000 && run.state !== 'running' && !status.running;
      if (finished) {
        if (run.state === 'ok' && status.archives[0]) {
          this.onBackupComplete?.(status.archives[0].filename, status.archives[0].sizeBytes);
        }
        return;
      }
      if (Date.now() < deadline) this.watchTimer = setTimeout(() => void tick(), RUN_POLL_MS);
    };
    this.watchTimer = setTimeout(() => void tick(), RUN_POLL_MS);
  }

  private sshArgs(cfg: BackupGatewayConfig): string[] {
    return [
      '-i', cfg.keyPath.replace(/^~(?=\/)/, os.homedir()),
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=8',
      '-o', 'StrictHostKeyChecking=accept-new',
      cfg.host,
    ];
  }
}

function emptyStatus(cfg: BackupGatewayConfig, error: string): HostBackupStatus {
  return {
    configured: Boolean(cfg.host),
    reachable: false,
    error,
    host: cfg.host,
    server: '',
    keep: 0,
    archives: [],
    lastRun: null,
    running: false,
    restoring: false,
    schedule: { nextRunAt: null, lastRunAt: null },
    disk: null,
  };
}

function describeSshError(error: unknown): string {
  const stderr = (error as { stderr?: string }).stderr?.trim();
  if (stderr) return stderr.split('\n').pop() ?? stderr;
  return error instanceof Error ? error.message : String(error);
}

import * as fs from 'fs/promises';
import * as path from 'path';
import { RestartSchedule, RestartScheduleResult } from '../types/index.js';
import { config } from '../config.js';
import { ServerManager } from './ServerManager.js';

const MAX_INTERVAL_HOURS = 168; // 1 week

export class RestartScheduler {
  private schedule: RestartSchedule = { enabled: false, intervalHours: 6, nextRestart: null };
  private fiveMinTimer: NodeJS.Timeout | null = null;
  private oneMinTimer: NodeJS.Timeout | null = null;
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly serverManager: ServerManager,
    private readonly onScheduleChanged: (schedule: RestartSchedule) => void,
  ) {}

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(config.restartSchedulePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<RestartSchedule>;
      if (
        typeof parsed.enabled === 'boolean' &&
        typeof parsed.intervalHours === 'number' &&
        (parsed.nextRestart === null || typeof parsed.nextRestart === 'string')
      ) {
        this.schedule = {
          enabled: parsed.enabled,
          intervalHours: parsed.intervalHours,
          nextRestart: parsed.nextRestart ?? null,
        };
      }
    } catch {
      // File doesn't exist or is malformed — start with defaults
    }

    if (!this.schedule.enabled || !this.schedule.nextRestart) return;

    const storedNext = new Date(this.schedule.nextRestart).getTime();
    const now = Date.now();
    const intervalMs = this.schedule.intervalHours * 3600 * 1000;

    if (storedNext > now) {
      this.armTimers(storedNext - now);
    } else {
      const elapsed = now - storedNext;
      const missedIntervals = Math.ceil(elapsed / intervalMs);
      const newNext = storedNext + missedIntervals * intervalMs;
      this.schedule.nextRestart = new Date(newNext).toISOString();
      await this.persist();
      this.armTimers(newNext - now);
    }
  }

  getSchedule(): RestartSchedule {
    return { ...this.schedule };
  }

  async setSchedule(patch: Partial<RestartSchedule>): Promise<RestartScheduleResult> {
    const intervalHours =
      patch.intervalHours !== undefined ? patch.intervalHours : this.schedule.intervalHours;

    if (
      typeof intervalHours !== 'number' ||
      !isFinite(intervalHours) ||
      intervalHours <= 0 ||
      intervalHours > MAX_INTERVAL_HOURS
    ) {
      return { success: false, message: `intervalHours must be between 1 and ${MAX_INTERVAL_HOURS}` };
    }

    const enabled = patch.enabled !== undefined ? patch.enabled : this.schedule.enabled;
    const wasEnabled = this.schedule.enabled;

    this.schedule.intervalHours = intervalHours;
    this.schedule.enabled = enabled;

    if (!enabled) {
      this.schedule.nextRestart = null;
    } else if (!wasEnabled || !this.schedule.nextRestart) {
      // Enabling from disabled state — compute first restart from now
      this.schedule.nextRestart = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
    } else if (patch.intervalHours !== undefined && patch.intervalHours !== intervalHours) {
      // Interval changed while already enabled — rebase nextRestart from now
      this.schedule.nextRestart = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
    }

    this.clearTimers();
    await this.persist();

    if (this.schedule.enabled && this.schedule.nextRestart) {
      const msUntilRestart = new Date(this.schedule.nextRestart).getTime() - Date.now();
      this.armTimers(msUntilRestart);
    }

    this.onScheduleChanged({ ...this.schedule });
    return { success: true, message: 'Schedule updated', schedule: { ...this.schedule } };
  }

  stop(): void {
    this.clearTimers();
  }

  private armTimers(msUntilRestart: number): void {
    const fiveMinMs = msUntilRestart - 5 * 60 * 1000;
    const oneMinMs = msUntilRestart - 1 * 60 * 1000;

    if (fiveMinMs > 0) {
      this.fiveMinTimer = setTimeout(() => {
        this.sendWarning('say [Auto-Restart] Server restarts in 5 minutes!');
      }, fiveMinMs);
    }

    if (oneMinMs > 0) {
      this.oneMinTimer = setTimeout(() => {
        this.sendWarning('say [Auto-Restart] Server restarts in 1 minute!');
      }, oneMinMs);
    }

    if (msUntilRestart > 0) {
      this.restartTimer = setTimeout(() => {
        void this.executeRestart();
      }, msUntilRestart);
    } else {
      void this.executeRestart();
    }
  }

  private async executeRestart(): Promise<void> {
    try {
      if (await this.serverManager.isRunning()) {
        await this.serverManager.restart();
      }
    } catch (error) {
      console.error('RestartScheduler: restart failed:', error);
    }
    await this.scheduleNext();
  }

  private async scheduleNext(): Promise<void> {
    if (!this.schedule.enabled || !this.schedule.nextRestart) return;

    const intervalMs = this.schedule.intervalHours * 3600 * 1000;
    const prevNext = new Date(this.schedule.nextRestart).getTime();
    this.schedule.nextRestart = new Date(prevNext + intervalMs).toISOString();

    await this.persist();
    this.onScheduleChanged({ ...this.schedule });

    const msUntilRestart = new Date(this.schedule.nextRestart).getTime() - Date.now();
    this.armTimers(msUntilRestart);
  }

  private sendWarning(command: string): void {
    this.serverManager.sendConsoleCommand(command).catch((err) => {
      console.error('RestartScheduler: failed to send warning:', err);
    });
  }

  private clearTimers(): void {
    if (this.fiveMinTimer) { clearTimeout(this.fiveMinTimer); this.fiveMinTimer = null; }
    if (this.oneMinTimer) { clearTimeout(this.oneMinTimer); this.oneMinTimer = null; }
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(config.restartSchedulePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(config.restartSchedulePath, JSON.stringify(this.schedule, null, 2), 'utf-8');
  }
}

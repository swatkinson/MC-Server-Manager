import * as fs from 'fs/promises';
import * as path from 'path';
import { RestartSchedule, RestartScheduleResult } from '../types/index.js';
import { config } from '../config.js';
import { ServerManager } from './ServerManager.js';

const DEFAULT_HOUR = 4;
const DEFAULT_MINUTE = 0;

function computeNext(hour: number, minute: number): Date {
  const now = new Date();
  const candidate = new Date();
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export class RestartScheduler {
  private schedule: RestartSchedule = {
    enabled: false,
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    nextRestart: null,
  };
  private fiveMinTimer: NodeJS.Timeout | null = null;
  private oneMinTimer: NodeJS.Timeout | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  onBeforeRestart: (() => void) | null = null;
  onAfterRestart: (() => void) | null = null;

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
        typeof parsed.hour === 'number' &&
        typeof parsed.minute === 'number' &&
        (parsed.nextRestart === null || typeof parsed.nextRestart === 'string')
      ) {
        this.schedule = {
          enabled: parsed.enabled,
          hour: parsed.hour,
          minute: parsed.minute,
          nextRestart: parsed.nextRestart ?? null,
        };
      }
    } catch {
      // File doesn't exist or is malformed — start with defaults
    }

    if (!this.schedule.enabled) return;

    const next = computeNext(this.schedule.hour, this.schedule.minute);
    this.schedule.nextRestart = next.toISOString();
    await this.persist();
    this.armTimers(next.getTime() - Date.now());
  }

  getSchedule(): RestartSchedule {
    return { ...this.schedule };
  }

  async setSchedule(patch: Partial<RestartSchedule>): Promise<RestartScheduleResult> {
    const hour = patch.hour !== undefined ? patch.hour : this.schedule.hour;
    const minute = patch.minute !== undefined ? patch.minute : this.schedule.minute;

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return { success: false, message: 'hour must be an integer between 0 and 23' };
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      return { success: false, message: 'minute must be an integer between 0 and 59' };
    }

    const enabled = patch.enabled !== undefined ? patch.enabled : this.schedule.enabled;

    this.schedule.hour = hour;
    this.schedule.minute = minute;
    this.schedule.enabled = enabled;

    this.clearTimers();

    if (enabled) {
      const next = computeNext(hour, minute);
      this.schedule.nextRestart = next.toISOString();
      this.armTimers(next.getTime() - Date.now());
    } else {
      this.schedule.nextRestart = null;
    }

    await this.persist();
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

    this.restartTimer = setTimeout(() => {
      void this.executeRestart();
    }, Math.max(0, msUntilRestart));
  }

  private async executeRestart(): Promise<void> {
    this.onBeforeRestart?.();
    try {
      if (await this.serverManager.isRunning()) {
        await this.serverManager.restart();
        this.onAfterRestart?.();
      }
    } catch (error) {
      console.error('RestartScheduler: restart failed:', error);
    }
    await this.scheduleNext();
  }

  private async scheduleNext(): Promise<void> {
    if (!this.schedule.enabled) return;

    const next = computeNext(this.schedule.hour, this.schedule.minute);
    this.schedule.nextRestart = next.toISOString();

    await this.persist();
    this.onScheduleChanged({ ...this.schedule });
    this.armTimers(next.getTime() - Date.now());
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

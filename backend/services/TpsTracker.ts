import { LogLine, TpsMetrics } from '../types/index.js';
import { ConsoleManager } from './ConsoleManager.js';

const POLL_INTERVAL_MS = 10_000;
// MSPT readings older than this are treated as stale and the gauge clears.
const STALE_AFTER_MS = 45_000;
// A vanilla Minecraft tick budget is 50 ms (20 ticks per second).
const TICK_BUDGET_MS = 50;

// Strip Minecraft section-sign color/format codes (e.g. §a, §6).
function stripColors(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

export class TpsTracker {
  private tps: number | null = null;
  private mspt: number | null = null;
  private source: 'paper' | 'forge' | null = null;
  private lastUpdatedMs = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunningProbe: (() => Promise<boolean>) | null = null;

  constructor(private readonly consoleManager: ConsoleManager) {}

  setRunningProbe(probe: () => Promise<boolean>): void {
    this.isRunningProbe = probe;
  }

  start(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  observe(line: LogLine): void {
    const message = stripColors(line.message);

    // Paper / Purpur / Spigot `/tps` output:
    //   "TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0"
    // The leading "*" marks values that have been capped to 20.
    const paperTps = message.match(
      /TPS from last [^:]+:\s*\*?(\d+(?:\.\d+)?)/i,
    );
    if (paperTps) {
      this.tps = parseFloat(paperTps[1]);
      this.source = 'paper';
      this.lastUpdatedMs = Date.now();
    }

    // Paper `/mspt` output (1.18+):
    //   "Server tick times (avg/max) from last 5s, 10s, 1m: 4.62/16.71, ..."
    const paperMspt = message.match(
      /tick times\s*\(avg\/max\)[^:]*:\s*(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/i,
    );
    if (paperMspt) {
      this.mspt = parseFloat(paperMspt[1]);
      this.source = 'paper';
      this.lastUpdatedMs = Date.now();
    }

    // Forge `/forge tps` output:
    //   "Overall: Mean tick time: 22.500 ms. Mean TPS: 20.000"
    const forge = message.match(
      /Overall:\s*Mean tick time:\s*(\d+(?:\.\d+)?)\s*ms\.\s*Mean TPS:\s*(\d+(?:\.\d+)?)/i,
    );
    if (forge) {
      this.mspt = parseFloat(forge[1]);
      this.tps = parseFloat(forge[2]);
      this.source = 'forge';
      this.lastUpdatedMs = Date.now();
    }
  }

  getMetrics(): TpsMetrics | null {
    const now = Date.now();
    if (this.lastUpdatedMs === 0 || now - this.lastUpdatedMs > STALE_AFTER_MS) {
      return null;
    }
    const headroomPercent =
      this.mspt !== null
        ? Math.max(0, Math.min(100, ((TICK_BUDGET_MS - this.mspt) / TICK_BUDGET_MS) * 100))
        : null;
    return {
      tps: this.tps,
      mspt: this.mspt,
      headroomPercent,
      source: this.source,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  private async poll(): Promise<void> {
    if (this.isRunningProbe) {
      try {
        const running = await this.isRunningProbe();
        if (!running) {
          this.reset();
          return;
        }
      } catch {
        return;
      }
    }
    // Send each known command. The server runs whichever it understands and
    // ignores the rest (logged at INFO as "Unknown command" — harmless).
    for (const command of ['tps', 'mspt', 'forge tps']) {
      try {
        await this.consoleManager.executeCommand(command);
      } catch {
        // Server may have stopped between probe and send.
      }
    }
  }

  private reset(): void {
    this.tps = null;
    this.mspt = null;
    this.source = null;
    this.lastUpdatedMs = 0;
  }
}

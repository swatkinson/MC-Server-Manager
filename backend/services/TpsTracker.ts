import { LogLine, TpsMetrics, ServerType } from '../types/index.js';
import { ConsoleManager } from './ConsoleManager.js';

const POLL_INTERVAL_MS = 10_000;
// MSPT readings older than this are treated as stale and the gauge clears.
const STALE_AFTER_MS = 45_000;
// Window after a poll during which log lines may be ours. Outside the
// window we don't consume lines so a manual `/tps` from the user still
// shows up in the console panel.
const CONSUME_WINDOW_MS = 8_000;
// A vanilla Minecraft tick budget is 50 ms (20 ticks per second).
const TICK_BUDGET_MS = 50;

// Strip Minecraft section-sign color/format codes (e.g. §a, §6).
function stripColors(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

// Spark prefixes every line of its output with a lightning glyph: "[⚡] ".
// Strip it so the payload can be parsed/matched like any other line.
function stripSparkPrefix(text: string): string {
  return text.replace(/\[?⚡\]?/g, '').replace(/^\s+/, '');
}

// Stateless check for lines our probes produce. Used to clean console history
// read back from latest.log, where the live poll-window context is gone.
export function isProbeNoise(message: string): boolean {
  const m = stripColors(message);
  if (m.includes('⚡')) return true;
  if (/Mean TPS:/i.test(m)) return true;
  if (/TPS from last [^:]+:/i.test(m) || /tick times\s*\(avg\/max\)/i.test(m)) return true;
  if (/<--\[HERE\]/.test(m) && /\b(tps|mspt|forge|spark)\b/i.test(m)) return true;
  return /Unknown or incomplete command/i.test(m) || (/Unknown command/i.test(m) && /(tps|mspt|forge|spark)/i.test(m));
}

export class TpsTracker {
  private tps: number | null = null;
  private mspt: number | null = null;
  private source: 'paper' | 'forge' | 'spark' | null = null;
  private lastUpdatedMs = 0;
  private lastPollMs = 0;
  // Tracks when we last saw a Spark TPS header so we can match the values line
  private sparkHeaderMs = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunningProbe: (() => Promise<boolean>) | null = null;
  private serverTypeProvider: (() => Promise<ServerType>) | null = null;

  constructor(private readonly consoleManager: ConsoleManager) {}

  setRunningProbe(probe: () => Promise<boolean>): void {
    this.isRunningProbe = probe;
  }

  setServerTypeProvider(provider: () => Promise<ServerType>): void {
    this.serverTypeProvider = provider;
  }

  private async commandsForCurrentType(): Promise<string[]> {
    if (!this.serverTypeProvider) return ['tps', 'mspt', 'forge tps'];
    const type = await this.serverTypeProvider();
    switch (type) {
      // `forge tps` alone — `spark tps` printed ~12 extra lines into latest.log
      // every poll. Spark output is still parsed if someone runs it by hand.
      case 'forge': return ['forge tps'];
      case 'vanilla': return [];
      case 'paper':
      case 'purpur':
      case 'spigot':
      case 'craftbukkit': return ['tps', 'mspt'];
      case 'fabric': return ['tps'];  // Carpet mod uses /tps
      default: return ['tps', 'mspt', 'forge tps'];
    }
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

  /**
   * Returns true if the line was a response (or error response) to one of
   * our polling commands and should be hidden from the console panel.
   */
  observe(line: LogLine): boolean {
    const message = stripColors(line.message);
    const isSpark = message.includes('⚡');
    let matched = false;

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
      matched = true;
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
      matched = true;
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
      matched = true;
    }

    // Spark `/spark tps` output (every line prefixed with "[⚡] "):
    //   header: "TPS from last 5s, 10s, 1m, 5m, 15m:"
    //   values: " *20.0, 20.0, *20.0, *20.0, *20.0"  (the "*" marks capped values)
    // Detect the header and record the timestamp so the values line can be matched next.
    const sparkBody = stripSparkPrefix(message);
    if (/TPS from last\s+5s\b[^:]*:\s*$/.test(sparkBody.trim())) {
      this.sparkHeaderMs = Date.now();
      return Date.now() - this.lastPollMs < CONSUME_WINDOW_MS;
    }
    if (this.sparkHeaderMs > 0 && Date.now() - this.sparkHeaderMs < 2000) {
      const sparkVal = sparkBody.trim().match(/^\*?(\d+(?:\.\d+)?)[\s,]/);
      if (sparkVal) {
        this.tps = parseFloat(sparkVal[1]);
        this.source = 'spark';
        this.lastUpdatedMs = Date.now();
        this.sparkHeaderMs = 0;
        matched = true;
      }
    }

    if (matched) return true;

    // Within the poll window, also swallow the "Unknown command" feedback
    // and the per-dimension forge lines so the console panel stays clean.
    const withinWindow = Date.now() - this.lastPollMs < CONSUME_WINDOW_MS;
    if (!withinWindow) return false;

    // Any Spark-prefixed line within the poll window is our `spark tps` probe
    // output (tick-duration rows, CPU usage, blank "[⚡]" spacers). Swallow it.
    if (isSpark) {
      return true;
    }

    // Vanilla / Paper unknown-command echoes with the caret marker, e.g.:
    //   "Unknown or incomplete command, see below for error"
    //   "tps<--[HERE]" / "mspt<--[HERE]" / "forge<--[HERE]" / "spark<--[HERE]"
    if (/<--\[HERE\]/.test(message) && /\b(tps|mspt|forge|spark)\b/i.test(message)) {
      return true;
    }
    if (/Unknown or incomplete command/i.test(message)) {
      return true;
    }
    if (/Unknown command/i.test(message) && /(tps|mspt|forge|spark)/i.test(message)) {
      return true;
    }
    // Suppress Spark CPU usage lines that accompany `spark tps` output
    if (/CPU usage from last/i.test(message) || /\(system\)$|\(process\)$/.test(message.trim())) {
      return true;
    }
    // Forge per-dimension lines printed by `/forge tps`:
    //   "Dim minecraft:overworld: Mean tick time: 1.234 ms. Mean TPS: 20.000"
    if (/Mean TPS:/i.test(message)) {
      return true;
    }
    return false;
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
    this.lastPollMs = Date.now();
    const commands = await this.commandsForCurrentType();
    for (const command of commands) {
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
    this.sparkHeaderMs = 0;
  }
}

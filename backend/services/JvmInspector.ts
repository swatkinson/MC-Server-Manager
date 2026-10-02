import * as fs from 'fs/promises';
import { JvmMemory, JvmPressure, JvmSample } from '../types/index.js';
import { findJavaPid } from './processUtils.js';
import { PerfCounters, num, readHsperfdataForPid, str } from './hsperfdata.js';

const SAMPLE_INTERVAL_MS = 5_000;
// 1 h of history at one sample per 5 s.
const HISTORY_LIMIT = 720;
// GC pause share is averaged over this window so one long pause doesn't spike the reading.
const GC_WINDOW_MS = 60_000;

interface RawPoint {
  wallMs: number;
  hrtTicks: number;
  gcTicks: number;
  youngGcCount: number;
}

// Samples the Minecraft JVM's own memory counters on a fixed cadence and keeps
// a rolling history for the dashboard graph.
//
// Why not just RSS / system RAM: with -Xms == -Xmx and -XX:+AlwaysPreTouch the
// JVM reserves its entire heap from the OS at boot, so the process footprint
// is flat at ~Xmx forever. What actually tells you whether Minecraft is short
// on memory is inside the heap:
//   - heapUsed: everything in the heap right now, including garbage that the
//     next young GC will discard (sawtooths constantly — not a useful signal alone)
//   - heapLive: old generation + survivors, i.e. what survived the last GC —
//     the memory the game genuinely holds on to
//   - GC pause share: when live data approaches the max, the collector runs
//     back-to-back and the server stalls; that's the "throttled" state
export class JvmInspector {
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;
  private pid: number | null = null;
  private raw: RawPoint[] = [];
  private history: JvmSample[] = [];
  private latest: JvmMemory | null = null;

  start(): void {
    if (this.timer) return;
    void this.sample();
    this.timer = setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getLatest(): JvmMemory | null {
    return this.latest;
  }

  getHistory(): JvmSample[] {
    return this.history;
  }

  private async sample(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      const pid = await findJavaPid();
      if (pid !== this.pid) {
        // New JVM (or none) — history from the previous process no longer applies.
        this.pid = pid;
        this.raw = [];
        this.history = [];
      }
      if (!pid) {
        this.latest = null;
        return;
      }

      const [counters, rss] = await Promise.all([readHsperfdataForPid(pid), readProcessRss(pid)]);
      this.latest = counters ? this.fromCounters(counters, rss) : fromRssOnly(rss);
      if (this.latest) this.pushHistory(this.latest);
    } catch (error) {
      console.error('JVM sample failed:', error);
    } finally {
      this.sampling = false;
    }
  }

  private fromCounters(c: PerfCounters, rss: number | null): JvmMemory {
    const eden = num(c, 'sun.gc.generation.0.space.0.used');
    const survivors = num(c, 'sun.gc.generation.0.space.1.used') + num(c, 'sun.gc.generation.0.space.2.used');
    const old = num(c, 'sun.gc.generation.1.space.0.used');
    const committed = num(c, 'sun.gc.generation.0.capacity') + num(c, 'sun.gc.generation.1.capacity');

    const frequency = num(c, 'sun.os.hrt.frequency') || 1_000_000_000;
    const hrtTicks = num(c, 'sun.os.hrt.ticks');

    let gcTicks = 0;
    let fullGcCount = 0;
    let lastFullExit = 0;
    let youngGcCount = 0;
    for (let i = 0; c.has(`sun.gc.collector.${i}.name`); i++) {
      const name = str(c, `sun.gc.collector.${i}.name`).toLowerCase();
      gcTicks += num(c, `sun.gc.collector.${i}.time`);
      const invocations = num(c, `sun.gc.collector.${i}.invocations`);
      if (name.includes('full') || (i === 1 && !name.includes('phases'))) {
        fullGcCount += invocations;
        lastFullExit = Math.max(lastFullExit, num(c, `sun.gc.collector.${i}.lastExitTime`));
      } else if (i === 0) {
        youngGcCount = invocations;
      }
    }

    const now = Date.now();
    this.raw.push({ wallMs: now, hrtTicks, gcTicks, youngGcCount });
    while (this.raw.length > 2 && now - this.raw[1].wallMs >= GC_WINDOW_MS) this.raw.shift();
    const first = this.raw[0];
    const elapsedTicks = hrtTicks - first.hrtTicks;
    const gcPausePercent =
      this.raw.length > 1 && elapsedTicks > 0 ? clampPct(((gcTicks - first.gcTicks) / elapsedTicks) * 100) : null;
    const elapsedMin = (now - first.wallMs) / 60_000;
    const youngGcPerMin = this.raw.length > 1 && elapsedMin > 0 ? (youngGcCount - first.youngGcCount) / elapsedMin : null;

    const heapMax = maxHeap(c);
    const heapLive = old + survivors;
    const lastFullGcAgoSec = fullGcCount > 0 && lastFullExit > 0 ? Math.max(0, (hrtTicks - lastFullExit) / frequency) : null;

    const { pressure, reason } = assessPressure(heapLive, heapMax, gcPausePercent, lastFullGcAgoSec);

    return {
      source: 'hsperfdata',
      heapUsed: eden + survivors + old,
      heapLive,
      heapCommitted: committed,
      heapMax,
      metaspaceUsed: num(c, 'sun.gc.metaspace.used'),
      rss,
      gcPausePercent,
      youngGcPerMin,
      fullGcCount,
      lastFullGcAgoSec,
      pressure,
      pressureReason: reason,
    };
  }

  private pushHistory(m: JvmMemory): void {
    this.history.push({
      t: Date.now(),
      heapUsed: m.heapUsed,
      heapLive: m.heapLive,
      heapCommitted: m.heapCommitted,
      gcPausePercent: m.gcPausePercent,
    });
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT);
  }
}

// -Xmx from the effective VM args (the launcher expands @user_jvm_args.txt
// before the JVM records them). Fall back to generation capacities: G1 reports
// the full heap as both young *and* old max, so take the larger rather than sum.
function maxHeap(c: PerfCounters): number | null {
  const fromArgs = parseXmx(str(c, 'java.rt.vmArgs'));
  if (fromArgs) return fromArgs;
  const young = num(c, 'sun.gc.generation.0.maxCapacity');
  const old = num(c, 'sun.gc.generation.1.maxCapacity');
  const isG1 = str(c, 'sun.gc.collector.0.name').includes('G1');
  const max = isG1 ? Math.max(young, old) : young + old;
  return max > 0 ? max : null;
}

export function parseXmx(args: string): number | null {
  let result: number | null = null;
  for (const token of args.split(/\s+/)) {
    const m = token.match(/^-Xmx(\d+)([kKmMgGtT]?)$/);
    if (!m) continue;
    const mult: Record<string, number> = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
    result = parseInt(m[1], 10) * mult[m[2].toLowerCase()]; // last -Xmx wins, like the JVM
  }
  return result;
}

function assessPressure(
  live: number,
  max: number | null,
  gcPct: number | null,
  lastFullGcAgoSec: number | null,
): { pressure: JvmPressure; reason: string } {
  const ratio = max ? live / max : 0;
  const pct = Math.round(ratio * 100);
  if (ratio >= 0.9) return { pressure: 'critical', reason: `Live data fills ${pct}% of the heap — the GC can't free enough room` };
  if (gcPct !== null && gcPct >= 10) return { pressure: 'critical', reason: `GC pauses take ${gcPct.toFixed(1)}% of server time — ticks are being stalled` };
  if (lastFullGcAgoSec !== null && lastFullGcAgoSec < 600) return { pressure: 'critical', reason: 'A full stop-the-world GC ran in the last 10 minutes' };
  if (ratio >= 0.75) return { pressure: 'elevated', reason: `Live data is at ${pct}% of the heap` };
  if (gcPct !== null && gcPct >= 3) return { pressure: 'elevated', reason: `GC pauses take ${gcPct.toFixed(1)}% of server time` };
  if (lastFullGcAgoSec !== null && lastFullGcAgoSec < 3600) return { pressure: 'elevated', reason: 'A full GC ran in the last hour' };
  return { pressure: 'ok', reason: max ? `Live data uses ${pct}% of the heap — plenty of headroom` : 'GC is keeping up' };
}

// Used when the perf file is unavailable (e.g. -XX:+PerfDisableSharedMem):
// only the OS-level footprint is knowable, which can't show heap pressure.
function fromRssOnly(rss: number | null): JvmMemory | null {
  if (rss === null) return null;
  return {
    source: 'rss',
    heapUsed: rss,
    heapLive: rss,
    heapCommitted: rss,
    heapMax: null,
    metaspaceUsed: 0,
    rss,
    gcPausePercent: null,
    youngGcPerMin: null,
    fullGcCount: 0,
    lastFullGcAgoSec: null,
    pressure: 'ok',
    pressureReason: 'JVM perf counters unavailable — showing process memory only',
  };
}

function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

// /proc/<pid>/status is world-readable — VmRSS is the physical RAM the
// process currently occupies.
async function readProcessRss(pid: number): Promise<number | null> {
  try {
    const content = await fs.readFile(`/proc/${pid}/status`, 'utf-8');
    const match = content.match(/^VmRSS:\s+(\d+)\s+kB/m);
    return match ? parseInt(match[1], 10) * 1024 : null;
  } catch {
    return null;
  }
}

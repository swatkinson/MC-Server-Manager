import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { JvmHeap, SystemMetrics, TpsMetrics } from '../types/index.js';
import { config } from '../config.js';
import { findJavaPid } from './processUtils.js';

const execFileAsync = promisify(execFile);

const EMPTY_RAM: SystemMetrics['ram'] = {
  total: 0,
  used: 0,
  percentage: 0,
  jvm: null,
  systemOther: 0,
};

const EMPTY_METRICS: SystemMetrics = {
  cpu: { percentage: 0, cores: [] },
  ram: EMPTY_RAM,
  storage: { total: 0, used: 0, free: 0, percentage: 0 },
  tps: null,
};

const CPU_SAMPLE_INTERVAL_MS = 200;

type CpuTimes = { idle: number; total: number };
type CpuSnapshot = { aggregate: CpuTimes; cores: CpuTimes[] };
type TpsProvider = () => TpsMetrics | null;

export class MetricsCollector {
  private tpsProvider: TpsProvider | null = null;

  setTpsProvider(provider: TpsProvider): void {
    this.tpsProvider = provider;
  }

  async getMetrics(): Promise<SystemMetrics> {
    const [cpu, ram, storage] = await Promise.all([
      this.getCpuMetrics(),
      this.getRamMetrics(),
      this.getStorageMetrics(),
    ]);

    return { cpu, ram, storage, tps: this.tpsProvider ? this.tpsProvider() : null };
  }

  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    try {
      const before = await this.readCpuSnapshot();
      await new Promise((resolve) => setTimeout(resolve, CPU_SAMPLE_INTERVAL_MS));
      const after = await this.readCpuSnapshot();

      const computePercentage = (b: CpuTimes, a: CpuTimes): number => {
        const totalDelta = a.total - b.total;
        const idleDelta = a.idle - b.idle;
        return totalDelta > 0 ? clamp((1 - idleDelta / totalDelta) * 100) : 0;
      };

      const percentage = computePercentage(before.aggregate, after.aggregate);
      const cores = before.cores.map((b, i) => computePercentage(b, after.cores[i] ?? b));

      return { percentage, cores };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return EMPTY_METRICS.cpu;
    }
  }

  private async readCpuSnapshot(): Promise<CpuSnapshot> {
    const content = await fs.readFile('/proc/stat', 'utf-8');
    const lines = content.split('\n');

    // cpu  user nice system idle iowait irq softirq steal guest guest_nice
    // Steal (field 7) is excluded from total — it's time the hypervisor denied us,
    // not actual work the VM did, so including it inflates the usage reading.
    const parseLine = (line: string): CpuTimes => {
      const fields = line.trim().split(/\s+/).slice(1).map((n) => parseInt(n, 10) || 0);
      const idle = (fields[3] ?? 0) + (fields[4] ?? 0);
      const steal = fields[7] ?? 0;
      const total = fields.reduce((sum, v) => sum + v, 0) - steal;
      return { idle, total };
    };

    const aggregateLine = lines.find((l) => l.startsWith('cpu ')) ?? '';
    const coreLines = lines.filter((l) => /^cpu\d/.test(l));

    return {
      aggregate: parseLine(aggregateLine),
      cores: coreLines.map(parseLine),
    };
  }

  private async getRamMetrics(): Promise<SystemMetrics['ram']> {
    try {
      const content = await fs.readFile('/proc/meminfo', 'utf-8');
      const totalKb = parseMeminfo(content, 'MemTotal');
      const availableKb = parseMeminfo(content, 'MemAvailable');
      const total = totalKb * 1024;
      const used = Math.max(0, (totalKb - availableKb) * 1024);

      const jvm = await this.getJvmHeap();
      const systemOther = jvm
        ? Math.max(0, used - jvm.heapUsed)
        : used;

      return {
        total,
        used,
        percentage: total > 0 ? clamp((used / total) * 100) : 0,
        jvm,
        systemOther,
      };
    } catch (error) {
      console.error('Error getting RAM metrics:', error);
      return EMPTY_RAM;
    }
  }

  private async getJvmHeap(): Promise<JvmHeap | null> {
    const pid = await findJavaPid();
    if (!pid) return null;
    try {
      const [heapStats, heapMax] = await Promise.all([
        readHeapStats(pid),
        readMaxHeapFromCmdline(pid),
      ]);
      if (heapStats && heapMax) {
        return {
          heapUsed: heapStats.used,
          heapCommitted: heapStats.committed,
          heapMax,
        };
      }
      // jstat unavailable (not installed, wrong user, transitional JVM state).
      // Fall back to process RSS — world-readable from /proc regardless of owner.
      const rssBytes = await readProcessRss(pid);
      if (rssBytes === null) return null;
      return {
        heapUsed: rssBytes,
        heapCommitted: rssBytes,
        heapMax: heapMax,
        approximate: true,
      };
    } catch {
      return null;
    }
  }

  private async getStorageMetrics(): Promise<SystemMetrics['storage']> {
    try {
      const { stdout } = await execFileAsync('df', ['-B1', '--output=size,used,avail', config.storagePath]);
      const dataLine = stdout.trim().split('\n').slice(-1)[0] || '';
      const parts = dataLine.trim().split(/\s+/);
      const total = parseInt(parts[0] || '0', 10);
      const used = parseInt(parts[1] || '0', 10);
      const free = parseInt(parts[2] || '0', 10);

      return {
        total,
        used,
        free,
        percentage: total > 0 ? clamp((used / total) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      return EMPTY_METRICS.storage;
    }
  }
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function parseMeminfo(content: string, key: string): number {
  const match = content.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'));
  return match ? parseInt(match[1], 10) : 0;
}

// jstat reads JVM heap counters from the hsperfdata memory-mapped file —
// no Attach API, no signals to the JVM. Output (columns in KB):
//   S0C S1C S0U S1U EC EU OC OU MC MU CCSC CCSU YGC YGCT FGC FGCT CGC CGCT GCT
// Heap used = S0U + S1U + EU + OU; committed = S0C + S1C + EC + OC.
async function readHeapStats(pid: number): Promise<{ used: number; committed: number } | null> {
  try {
    const { stdout } = await execFileAsync('jstat', ['-gc', String(pid)], { timeout: 3_000 });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].trim().split(/\s+/);
    const values = lines[1].trim().split(/\s+/);
    const at = (key: string): number => {
      const i = headers.indexOf(key);
      if (i < 0) return 0;
      const parsed = parseFloat(values[i] ?? '');
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const usedKb = at('S0U') + at('S1U') + at('EU') + at('OU');
    const committedKb = at('S0C') + at('S1C') + at('EC') + at('OC');
    if (committedKb <= 0) return null;
    return { used: usedKb * 1024, committed: committedKb * 1024 };
  } catch {
    return null;
  }
}

// /proc/<pid>/status is world-readable (no ownership restriction) — VmRSS is
// the physical RAM the process currently occupies, used as a jstat fallback.
async function readProcessRss(pid: number): Promise<number | null> {
  try {
    const content = await fs.readFile(`/proc/${pid}/status`, 'utf-8');
    const match = content.match(/^VmRSS:\s+(\d+)\s+kB/m);
    return match ? parseInt(match[1], 10) * 1024 : null;
  } catch {
    return null;
  }
}

// /proc/<pid>/cmdline is null-separated. We scan it for an -Xmx flag and
// convert k/m/g suffixes to bytes. The JVM accepts e.g. -Xmx8G, -Xmx8192m,
// -Xmx8589934592.
async function readMaxHeapFromCmdline(pid: number): Promise<number | null> {
  try {
    const data = await fs.readFile(`/proc/${pid}/cmdline`, 'utf-8');
    for (const arg of data.split('\0')) {
      const match = arg.match(/^-Xmx(\d+)([kKmMgG]?)$/);
      if (!match) continue;
      const value = parseInt(match[1], 10);
      if (!Number.isFinite(value) || value <= 0) return null;
      switch (match[2].toLowerCase()) {
        case 'g':
          return value * 1024 * 1024 * 1024;
        case 'm':
          return value * 1024 * 1024;
        case 'k':
          return value * 1024;
        default:
          return value;
      }
    }
    return null;
  } catch {
    return null;
  }
}

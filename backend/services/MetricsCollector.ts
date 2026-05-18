import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { JvmHeap, SystemMetrics, TpsMetrics } from '../types/index.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

const EMPTY_RAM: SystemMetrics['ram'] = {
  total: 0,
  used: 0,
  percentage: 0,
  jvm: null,
  systemOther: 0,
};

const EMPTY_METRICS: SystemMetrics = {
  cpu: { percentage: 0 },
  ram: EMPTY_RAM,
  storage: { total: 0, used: 0, free: 0, percentage: 0 },
  tps: null,
};

const CPU_SAMPLE_INTERVAL_MS = 200;

type CpuTimes = { idle: number; total: number };
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
      const before = await this.readCpuTimes();
      await new Promise((resolve) => setTimeout(resolve, CPU_SAMPLE_INTERVAL_MS));
      const after = await this.readCpuTimes();

      const totalDelta = after.total - before.total;
      const idleDelta = after.idle - before.idle;
      const percentage = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;

      return { percentage: clamp(percentage) };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return EMPTY_METRICS.cpu;
    }
  }

  private async readCpuTimes(): Promise<CpuTimes> {
    const content = await fs.readFile('/proc/stat', 'utf-8');
    const line = content.split('\n').find((l) => l.startsWith('cpu ')) ?? '';
    // cpu  user nice system idle iowait irq softirq steal guest guest_nice
    const fields = line.trim().split(/\s+/).slice(1).map((n) => parseInt(n, 10) || 0);
    const idle = (fields[3] ?? 0) + (fields[4] ?? 0); // idle + iowait
    const total = fields.reduce((sum, v) => sum + v, 0);
    return { idle, total };
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
      const [heapInfoOutput, flagsOutput] = await Promise.all([
        execFileAsync('jcmd', [String(pid), 'GC.heap_info'], { timeout: 5_000 }),
        execFileAsync('jcmd', [String(pid), 'VM.flags'], { timeout: 5_000 }),
      ]);
      const { used, committed } = parseHeapInfo(heapInfoOutput.stdout);
      const maxFromFlag = parseMaxHeapFlag(flagsOutput.stdout);
      const heapMax = maxFromFlag ?? committed;
      if (heapMax <= 0) return null;
      return {
        heapUsed: used,
        heapCommitted: committed,
        heapMax,
      };
    } catch (error) {
      // jcmd may not be installed, or the JVM may be in a transitional state.
      // Returning null lets the gauge fall back to system-only display.
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

async function findJavaPid(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', 'java.*\\.jar']);
    const first = stdout.trim().split(/\s+/)[0];
    const parsed = parseInt(first, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// jcmd GC.heap_info output varies by collector. We look at the first line
// that describes the live heap (G1 / Parallel use "total X, used Y"; ZGC /
// Shenandoah use "used X, capacity Y"). Metaspace lines also report "used"
// and "committed", so we explicitly skip lines that mention metaspace or
// class space.
function parseHeapInfo(output: string): { used: number; committed: number } {
  let used = 0;
  let committed = 0;
  const lines = output.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('metaspace') || lower.includes('class space')) continue;
    const totalUsed = line.match(/total\s+(\d+)([KMG]),\s*used\s+(\d+)([KMG])/i);
    if (totalUsed) {
      committed = toBytes(parseInt(totalUsed[1], 10), totalUsed[2]);
      used = toBytes(parseInt(totalUsed[3], 10), totalUsed[4]);
      return { used, committed };
    }
    const usedCapacity = line.match(/used\s+(\d+)([KMG]),\s*capacity\s+(\d+)([KMG])/i);
    if (usedCapacity) {
      used = toBytes(parseInt(usedCapacity[1], 10), usedCapacity[2]);
      committed = toBytes(parseInt(usedCapacity[3], 10), usedCapacity[4]);
      return { used, committed };
    }
  }
  return { used, committed };
}

// jcmd VM.flags lists active flags including the heap ceiling, e.g.:
//   "-XX:MaxHeapSize=8589934592" (bytes)
function parseMaxHeapFlag(output: string): number | null {
  const match = output.match(/-XX:MaxHeapSize=(\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function toBytes(value: number, unit: string): number {
  switch (unit.toUpperCase()) {
    case 'K':
      return value * 1024;
    case 'M':
      return value * 1024 * 1024;
    case 'G':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

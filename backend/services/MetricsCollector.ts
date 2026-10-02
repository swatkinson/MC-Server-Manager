import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { SystemMetrics, TpsMetrics } from '../types/index.js';
import { config } from '../config.js';
import type { JvmInspector } from './JvmInspector.js';

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

  constructor(private readonly jvmInspector: JvmInspector | null = null) {}

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

      const jvm = this.jvmInspector?.getLatest() ?? null;
      // Everything the OS has handed out that isn't the Minecraft process.
      const systemOther = jvm?.rss != null ? Math.max(0, used - jvm.rss) : used;

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

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { SystemMetrics } from '../types/index.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

const EMPTY_METRICS: SystemMetrics = {
  cpu: { percentage: 0 },
  ram: { total: 0, used: 0, percentage: 0 },
  storage: { total: 0, used: 0, free: 0, percentage: 0 },
};

const CPU_SAMPLE_INTERVAL_MS = 200;

type CpuTimes = { idle: number; total: number };

export class MetricsCollector {
  async getMetrics(): Promise<SystemMetrics> {
    const [cpu, ram, storage] = await Promise.all([
      this.getCpuMetrics(),
      this.getRamMetrics(),
      this.getStorageMetrics(),
    ]);

    return { cpu, ram, storage };
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

      return {
        total,
        used,
        percentage: total > 0 ? clamp((used / total) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting RAM metrics:', error);
      return EMPTY_METRICS.ram;
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

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { SystemMetrics } from '../types/index.js';
import { config } from '../config.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const EMPTY_METRICS: SystemMetrics = {
  cpu: { percentage: 0, jvmPercentage: 0, otherPercentage: 0 },
  ram: { total: 0, used: 0, jvmAllocated: 0, jvmUsed: 0, percentage: 0 },
  storage: { total: 0, used: 0, free: 0, percentage: 0 },
};

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
      const { stdout } = await execAsync('top -bn1 | grep "Cpu(s)"');
      const match = stdout.match(/(\d+(?:\.\d+)?)\s*%?\s*us/);
      const percentage = match ? parseFloat(match[1]) : 0;

      const jvmPercentage = await this.getJvmCpuPercentage();

      return {
        percentage: Math.min(100, Math.max(0, percentage)),
        jvmPercentage: Math.min(100, Math.max(0, jvmPercentage)),
        otherPercentage: Math.max(0, percentage - jvmPercentage),
      };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return EMPTY_METRICS.cpu;
    }
  }

  private async getJvmCpuPercentage(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        "ps -C java -o %cpu= 2>/dev/null | awk '{sum+=$1} END {print sum+0}'",
      );
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async getRamMetrics(): Promise<SystemMetrics['ram']> {
    try {
      const { stdout } = await execFileAsync('free', ['-b']);
      const memLine = stdout.split('\n').find((line) => line.startsWith('Mem:')) || '';
      const parts = memLine.split(/\s+/);
      const total = parseInt(parts[1] || '0', 10);
      const used = parseInt(parts[2] || '0', 10);

      const { jvmAllocated, jvmUsed } = await this.getJvmHeap();

      return {
        total: Math.round(total / 1024 / 1024),
        used: Math.round(used / 1024 / 1024),
        jvmAllocated,
        jvmUsed,
        percentage: total > 0 ? Math.round((used / total) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting RAM metrics:', error);
      return EMPTY_METRICS.ram;
    }
  }

  private async getJvmHeap(): Promise<{ jvmAllocated: number; jvmUsed: number }> {
    try {
      const { stdout: pidOut } = await execFileAsync('pgrep', ['-f', 'java.*minecraft']);
      const pid = pidOut.split('\n')[0]?.trim();
      if (!pid) return { jvmAllocated: 0, jvmUsed: 0 };

      const { stdout } = await execFileAsync('jcmd', [pid, 'VM.memory_usage']);
      const heapLine = stdout.split('\n').find((line) => line.includes('Heap')) || '';
      const match = heapLine.match(/committed=(\d+).*used=(\d+)/);
      if (!match) return { jvmAllocated: 0, jvmUsed: 0 };

      return {
        jvmAllocated: Math.round(parseInt(match[1], 10) / 1024 / 1024),
        jvmUsed: Math.round(parseInt(match[2], 10) / 1024 / 1024),
      };
    } catch {
      return { jvmAllocated: 0, jvmUsed: 0 };
    }
  }

  private async getStorageMetrics(): Promise<SystemMetrics['storage']> {
    try {
      const { stdout } = await execFileAsync('df', ['-B1', config.storagePath]);
      const dataLine = stdout.trim().split('\n').slice(-1)[0] || '';
      const parts = dataLine.split(/\s+/);
      const total = parseInt(parts[1] || '0', 10);
      const used = parseInt(parts[2] || '0', 10);
      const free = parseInt(parts[3] || '0', 10);

      const gb = (bytes: number) => Math.round(bytes / 1024 / 1024 / 1024);

      return {
        total: gb(total),
        used: gb(used),
        free: gb(free),
        percentage: total > 0 ? Math.round((used / total) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      return EMPTY_METRICS.storage;
    }
  }
}

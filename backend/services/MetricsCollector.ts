import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemMetrics } from '../types/index.js';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export class MetricsCollector {
  private lastCpuUsage = { user: 0, idle: 0 };
  private lastCpuTime = Date.now();

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
      const { stdout } = await execAsync('top -bn1 | grep Cpu');
      const match = stdout.match(/(\d+\.\d+)%us/);
      const percentage = match ? parseFloat(match[1]) : 0;

      const { stdout: jvmStdout } = await execAsync('ps aux | grep java | grep -v grep | awk "{print $3}"');
      const jvmPercentage = jvmStdout.trim() ? parseFloat(jvmStdout.trim()) : 0;

      return {
        percentage: Math.min(100, percentage),
        jvmPercentage: Math.min(100, jvmPercentage),
        otherPercentage: Math.max(0, percentage - jvmPercentage),
      };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return { percentage: 0, jvmPercentage: 0, otherPercentage: 0 };
    }
  }

  private async getRamMetrics(): Promise<SystemMetrics['ram']> {
    try {
      const { stdout } = await execAsync('free -b | grep Mem');
      const parts = stdout.split(/\s+/);
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);

      const { stdout: jvmHeap } = await execAsync(
        'jcmd $(pgrep -f "java.*minecraft") VM.memory_usage 2>/dev/null | grep "Heap" | head -1'
      );
      const heapMatch = jvmHeap.match(/committed=(\d+).*used=(\d+)/);
      const jvmAllocated = heapMatch ? Math.round(parseInt(heapMatch[1]) / 1024 / 1024) : 0;
      const jvmUsed = heapMatch ? Math.round(parseInt(heapMatch[2]) / 1024 / 1024) : 0;

      return {
        total: Math.round(total / 1024 / 1024),
        used: Math.round(used / 1024 / 1024),
        jvmAllocated,
        jvmUsed,
        percentage: Math.round((used / total) * 100),
      };
    } catch (error) {
      console.error('Error getting RAM metrics:', error);
      return { total: 0, used: 0, jvmAllocated: 0, jvmUsed: 0, percentage: 0 };
    }
  }

  private async getStorageMetrics(): Promise<SystemMetrics['storage']> {
    try {
      const { stdout } = await execAsync('df -B1 /home | tail -1');
      const parts = stdout.split(/\s+/);
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const free = parseInt(parts[3]);

      return {
        total: Math.round(total / 1024 / 1024 / 1024),
        used: Math.round(used / 1024 / 1024 / 1024),
        free: Math.round(free / 1024 / 1024 / 1024),
        percentage: Math.round((used / total) * 100),
      };
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }
}

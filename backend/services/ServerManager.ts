import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { ServerStatus } from '../types/index.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

type ActionResult = { success: boolean; message: string };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ServerManager {
  private isTransitioning = false;

  async getStatus(): Promise<ServerStatus> {
    try {
      const [isRunning, properties, uptimeSeconds] = await Promise.all([
        this.isServerRunning(),
        this.readServerProperties(),
        this.getUptimeSeconds(),
      ]);

      return {
        status: isRunning ? 'online' : 'offline',
        uptime: isRunning ? uptimeSeconds : 0,
        version: (properties['server-version'] as string) || '1.20.1',
        motd: (properties['motd'] as string) || 'A Minecraft Server',
        ip: (properties['server-ip'] as string) || 'localhost',
        players: {
          current: 0,
          max: Number(properties['max-players']) || 20,
        },
      };
    } catch (error) {
      console.error('Error getting server status:', error);
      return {
        status: 'offline',
        uptime: 0,
        version: 'unknown',
        motd: 'Error reading server',
        ip: 'unknown',
        players: { current: 0, max: 20 },
      };
    }
  }

  async start(): Promise<ActionResult> {
    if (this.isTransitioning) {
      return { success: false, message: 'Server is already transitioning' };
    }

    this.isTransitioning = true;
    try {
      if (await this.isServerRunning()) {
        return { success: false, message: 'Server is already running' };
      }

      await execFileAsync(config.startScript, [], {
        cwd: config.minecraftDir,
        timeout: 30_000,
      });
      return { success: true, message: 'Server started' };
    } catch (error) {
      console.error('Error starting server:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to start server: ${message}` };
    } finally {
      this.isTransitioning = false;
    }
  }

  async stop(): Promise<ActionResult> {
    if (this.isTransitioning) {
      return { success: false, message: 'Server is already transitioning' };
    }

    this.isTransitioning = true;
    try {
      if (!(await this.isServerRunning())) {
        return { success: false, message: 'Server is not running' };
      }

      await this.sendConsoleCommand('say Server is shutting down...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.sendConsoleCommand('stop');

      await this.waitForShutdown(20_000);

      if (await this.isServerRunning()) {
        await execFileAsync('pkill', ['-f', 'java.*\\.jar'], { timeout: 10_000 });
      }
      return { success: true, message: 'Server stopped' };
    } catch (error) {
      console.error('Error stopping server:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to stop server: ${message}` };
    } finally {
      this.isTransitioning = false;
    }
  }

  async restart(): Promise<ActionResult> {
    const stopResult = await this.stop();
    if (!stopResult.success) return stopResult;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return this.start();
  }

  async sendConsoleCommand(command: string): Promise<void> {
    try {
      await execFileAsync('screen', ['-S', config.screenSession, '-X', 'stuff', `${command}\n`]);
    } catch (error) {
      console.error('Error sending console command:', error);
    }
  }

  private async isServerRunning(): Promise<boolean> {
    if (await this.isScreenSessionActive()) return true;
    return this.isJavaProcessRunning();
  }

  private async isScreenSessionActive(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('screen', ['-ls', config.screenSession]);
      const sessionPattern = new RegExp(`\\b\\d+\\.${escapeRegex(config.screenSession)}\\b`);
      return sessionPattern.test(stdout);
    } catch (error) {
      // `screen -ls` exits non-zero when no matching sessions exist; stdout is still on the error.
      const stdout = (error as { stdout?: string }).stdout ?? '';
      const sessionPattern = new RegExp(`\\b\\d+\\.${escapeRegex(config.screenSession)}\\b`);
      return sessionPattern.test(stdout);
    }
  }

  private async isJavaProcessRunning(): Promise<boolean> {
    try {
      await execFileAsync('pgrep', ['-f', 'java.*\\.jar']);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForShutdown(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await this.isServerRunning())) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async getUptimeSeconds(): Promise<number> {
    try {
      const stats = await fs.stat(config.worldPath);
      return Math.max(0, Math.floor((Date.now() - stats.mtimeMs) / 1000));
    } catch {
      return 0;
    }
  }

  private async readServerProperties(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(config.serverPropertiesPath, 'utf-8');
      const properties: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        properties[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
      return properties;
    } catch {
      return {};
    }
  }
}

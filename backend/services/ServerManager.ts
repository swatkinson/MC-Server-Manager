import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { ServerStatus } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export class ServerManager {
  private minecraftDir = process.env.MINECRAFT_DIR || `${process.env.HOME}/MinecraftServer`;
  private isTransitioning = false;

  async getStatus(): Promise<ServerStatus> {
    try {
      const isRunning = await this.isServerRunning();
      const config = await this.readServerProperties();
      const uptime = await this.getUptime();

      return {
        status: isRunning ? 'online' : 'offline',
        uptime,
        version: config.serverVersion || '1.20.1',
        motd: config.motd || 'A Minecraft Server',
        ip: config.ip || 'localhost',
        players: {
          current: 0,
          max: parseInt(config.maxPlayers as string) || 20,
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

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.isTransitioning) {
      return { success: false, message: 'Server is already transitioning' };
    }

    this.isTransitioning = true;
    try {
      const isRunning = await this.isServerRunning();
      if (isRunning) {
        return { success: false, message: 'Server is already running' };
      }

      await execAsync(`cd ${this.minecraftDir} && ./start.sh`, { timeout: 30000 });
      return { success: true, message: 'Server started' };
    } catch (error) {
      return { success: false, message: `Failed to start server: ${error}` };
    } finally {
      this.isTransitioning = false;
    }
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    if (this.isTransitioning) {
      return { success: false, message: 'Server is already transitioning' };
    }

    this.isTransitioning = true;
    try {
      const isRunning = await this.isServerRunning();
      if (!isRunning) {
        return { success: false, message: 'Server is not running' };
      }

      await this.sendConsoleCommand('say Server is shutting down...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await execAsync(`pkill -f 'java.*minecraft'`, { timeout: 30000 });
      return { success: true, message: 'Server stopped' };
    } catch (error) {
      return { success: false, message: `Failed to stop server: ${error}` };
    } finally {
      this.isTransitioning = false;
    }
  }

  async restart(): Promise<{ success: boolean; message: string }> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return this.start();
  }

  async sendConsoleCommand(command: string): Promise<void> {
    try {
      execFile('screen', ['-S', 'minecraft', '-X', 'stuff', `${command}\n`]);
    } catch (error) {
      console.error('Error sending console command:', error);
    }
  }

  private async isServerRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pgrep -f "java.*minecraft" | wc -l');
      return parseInt(stdout.trim()) > 0;
    } catch {
      return false;
    }
  }

  private async getUptime(): Promise<number> {
    try {
      const result = await fs.stat(path.join(this.minecraftDir, 'world'));
      return Date.now() - result.mtimeMs;
    } catch {
      return 0;
    }
  }

  private async readServerProperties(): Promise<Record<string, any>> {
    try {
      const content = await fs.readFile(
        path.join(this.minecraftDir, 'server.properties'),
        'utf-8'
      );
      const config: Record<string, any> = {};
      content.split('\n').forEach((line) => {
        const [key, value] = line.split('=');
        if (key && !key.startsWith('#')) {
          config[key] = value;
        }
      });
      return config;
    } catch {
      return {};
    }
  }
}

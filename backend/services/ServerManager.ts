import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerStatus, ServerType } from '../types/index.js';
import { config } from '../config.js';
import { findJavaPid, getProcessAgeSeconds } from './processUtils.js';
import { ServerInfoStore } from './ServerInfoStore.js';

const execFileAsync = promisify(execFile);

type ActionResult = { success: boolean; message: string };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ServerManager {
  private isTransitioning = false;
  private lastIntentionalStopMs = 0;

  constructor(private readonly infoStore: ServerInfoStore) {}

  async getStatus(): Promise<ServerStatus> {
    try {
      const [isRunning, properties, uptimeSeconds] = await Promise.all([
        this.isServerRunning(),
        this.readServerProperties(),
        this.getUptimeSeconds(),
      ]);

      let version: string;
      if (isRunning) {
        const detected = await this.detectAndPersistInfo();
        version = detected.version;
      } else {
        // Use persisted version when offline so it survives restarts
        version = await this.infoStore.getVersion();
      }

      return {
        status: isRunning ? 'online' : 'offline',
        uptime: isRunning ? uptimeSeconds : 0,
        version,
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

      this.lastIntentionalStopMs = Date.now();
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

  // `/stop` typed into the console (panel or in-game) is a deliberate stop too.
  markIntentionalStop(): void {
    this.lastIntentionalStopMs = Date.now();
  }

  stoppedIntentionallyWithin(ms: number): boolean {
    return Date.now() - this.lastIntentionalStopMs < ms;
  }

  async isRunning(): Promise<boolean> {
    return this.isServerRunning();
  }

  private async detectAndPersistInfo(): Promise<{ version: string; serverType: ServerType }> {
    const version = (await this.readVersionFromLog()) ?? (await this.readVersionFromJar()) ?? 'unknown';
    const serverType = await this.detectServerType();
    try {
      await this.infoStore.write({ version, serverType });
    } catch (err) {
      console.error('Failed to persist server info:', err);
    }
    return { version, serverType };
  }

  private async detectServerType(): Promise<ServerType> {
    const fromLog = await this.readTypeFromLog();
    if (fromLog) return fromLog;
    const fromFs = await this.readTypeFromFileSystem();
    if (fromFs) return fromFs;
    return (await this.readTypeFromJar()) ?? 'unknown';
  }

  private async readTypeFromLog(): Promise<ServerType | null> {
    let fd: fs.FileHandle | undefined;
    try {
      fd = await fs.open(config.logPath, 'r');
      const buf = Buffer.alloc(128 * 1024);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      const text = buf.subarray(0, bytesRead).toString('utf-8');

      if (/This server is running Purpur/i.test(text)) return 'purpur';
      if (/This server is running Paper/i.test(text)) return 'paper';
      // Spigot/CraftBukkit logs "This server is running CraftBukkit version"
      if (/This server is running CraftBukkit/i.test(text)) return 'spigot';
      if (/\[FabricLoader\]|Loading Fabric|net\.fabricmc/i.test(text)) return 'fabric';
      if (/Forge Mod Loader|MinecraftForge|\bFML\b/i.test(text)) return 'forge';
      return null;
    } catch {
      return null;
    } finally {
      await fd?.close().catch(() => {});
    }
  }

  private async readTypeFromFileSystem(): Promise<ServerType | null> {
    try {
      const entries = await fs.readdir(config.minecraftDir);
      const names = entries.map((e) => e.toLowerCase());

      // Fabric: look for fabric-server-launch.jar or .fabric directory
      if (names.some((n) => n === 'fabric-server-launch.jar' || n === '.fabric')) return 'fabric';

      // Forge: look for libraries/net/minecraftforge/ or user_jvm_args.txt
      if (names.includes('user_jvm_args.txt')) return 'forge';
      try {
        await fs.access(path.join(config.minecraftDir, 'libraries', 'net', 'minecraftforge'));
        return 'forge';
      } catch {}

      return null;
    } catch {
      return null;
    }
  }

  private async readTypeFromJar(): Promise<ServerType | null> {
    try {
      const entries = await fs.readdir(config.minecraftDir);
      const jars = entries.filter((n) => n.toLowerCase().endsWith('.jar'));
      for (const name of jars) {
        const lower = name.toLowerCase();
        if (lower.includes('purpur')) return 'purpur';
        if (lower.includes('paper')) return 'paper';
        if (lower.includes('spigot')) return 'spigot';
        if (lower.includes('craftbukkit')) return 'craftbukkit';
        if (lower.includes('fabric')) return 'fabric';
        if (lower.includes('forge')) return 'forge';
        if (lower === 'server.jar' || lower.startsWith('minecraft_server')) return 'vanilla';
      }
      return null;
    } catch {
      return null;
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
    const pid = await findJavaPid();
    if (!pid) return 0;
    const age = await getProcessAgeSeconds(pid);
    return age ?? 0;
  }

  private async readVersionFromLog(): Promise<string | null> {
    let fd: fs.FileHandle | undefined;
    try {
      fd = await fs.open(config.logPath, 'r');
      // Forge startup logs can be several hundred KB before the server thread
      // begins (mod discovery, class transformation, etc.), so 1 MB is needed.
      const buf = Buffer.alloc(1024 * 1024);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      const text = buf.subarray(0, bytesRead).toString('utf-8');
      const match = text.match(/Starting minecraft server version (\S+)/i);
      return match ? match[1] : null;
    } catch {
      return null;
    } finally {
      await fd?.close().catch(() => {});
    }
  }

  private async readVersionFromJar(): Promise<string | null> {
    try {
      const entries = await fs.readdir(config.minecraftDir);
      const jars = entries.filter((name) => name.toLowerCase().endsWith('.jar'));
      const serverNamePattern =
        /^(server|paper|purpur|spigot|craftbukkit|fabric|forge|vanilla|minecraft[_-]server)/i;
      const versionPattern = /(\d+\.\d+(?:\.\d+)?)/;
      const ranked = [...jars].sort(
        (a, b) => Number(serverNamePattern.test(b)) - Number(serverNamePattern.test(a)),
      );
      for (const name of ranked) {
        const match = path.basename(name, '.jar').match(versionPattern);
        if (match) return match[1];
      }
      return null;
    } catch {
      return null;
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

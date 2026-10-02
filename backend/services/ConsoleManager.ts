import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { LogLine, Player } from '../types/index.js';
import { PlayerManager } from './PlayerManager.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

const COMMAND_REGEX = /^[A-Za-z0-9 _.\-:/@!?'"=,()\[\]{}+*]+$/;
const LOG_POLL_INTERVAL_MS = 1000;

export function isValidCommand(command: string): boolean {
  if (!command || typeof command !== 'string') return false;
  const trimmed = command.trim();
  return trimmed.length > 0 && trimmed.length <= 500 && COMMAND_REGEX.test(trimmed);
}

// Returns true when the line was consumed (e.g. a TPS probe reply) and should
// stay out of the console.
type LineCallback = (line: LogLine) => boolean;
type HistoryFilter = (line: LogLine) => boolean;
type PlayersCallback = (players: Player[]) => void;

export class ConsoleManager {
  private lastReadPosition = 0;
  private lastKnownIno: number | null = null;
  private playerManager: PlayerManager | null = null;
  private onPlayersUpdate: PlayersCallback | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private polling = false;
  // Lines the console has shown, newest last. Served to clients on load so
  // history matches the live stream (minus probe replies).
  private history: LogLine[] = [];

  getLogs(limit: number = 50): LogLine[] {
    const bounded = Math.max(1, Math.min(limit, config.maxConsoleLogLimit));
    return this.history.slice(-bounded);
  }

  private remember(line: LogLine): void {
    this.history.push(line);
    const overflow = this.history.length - config.maxConsoleLogLimit;
    if (overflow > 0) this.history.splice(0, overflow);
  }

  // Seed history from the tail of latest.log, dropping lines `isNoise` flags.
  private async seedHistory(isNoise: HistoryFilter): Promise<void> {
    try {
      const content = await fs.readFile(config.logPath, 'utf-8');
      for (const raw of content.split('\n')) {
        const parsed = this.parseLine(raw);
        if (!parsed) continue;
        if (!isNoise(parsed)) this.remember(parsed);
        this.checkForPlayerEvents(parsed);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Error reading logs:', error);
    }
  }

  setPlayerManager(playerManager: PlayerManager, onPlayersUpdate: PlayersCallback): void {
    this.playerManager = playerManager;
    this.onPlayersUpdate = onPlayersUpdate;
  }

  async watchLogs(callback: LineCallback, isNoise: HistoryFilter): Promise<void> {
    if (this.pollTimer) return;
    await this.seedHistory(isNoise);

    // Seed position from the current end of file so we don't replay history.
    // If the file doesn't exist yet, the poller will pick it up when it appears.
    try {
      const stat = await fs.stat(config.logPath);
      this.lastReadPosition = stat.size;
      this.lastKnownIno = stat.ino;
    } catch {
      this.lastReadPosition = 0;
      this.lastKnownIno = null;
    }

    const tick = async () => {
      if (this.polling) return;
      this.polling = true;
      try {
        await this.pollOnce(callback);
      } finally {
        this.polling = false;
      }
    };

    this.pollTimer = setInterval(tick, LOG_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async executeCommand(command: string): Promise<void> {
    if (!isValidCommand(command)) {
      throw new Error('Invalid command');
    }
    const trimmed = command.trim();

    try {
      await execFileAsync('screen', [
        '-S',
        config.screenSession,
        '-X',
        'stuff',
        `${trimmed}\n`,
      ]);
    } catch (error) {
      console.error('Error executing command:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute command: ${message}`);
    }
  }

  private async pollOnce(callback: LineCallback): Promise<void> {
    let stat;
    try {
      stat = await fs.stat(config.logPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Log file gone (server stopped / not yet started). Reset so we replay
        // from the start of the next file when it appears.
        this.lastReadPosition = 0;
        this.lastKnownIno = null;
        return;
      }
      throw error;
    }

    // Detect log rotation: inode changed (Minecraft renames latest.log to
    // <date>.log.gz and creates a new one on every server start) or file
    // shrank (truncation). Either way, start over from offset 0.
    if (this.lastKnownIno !== null && stat.ino !== this.lastKnownIno) {
      this.lastReadPosition = 0;
    } else if (stat.size < this.lastReadPosition) {
      this.lastReadPosition = 0;
    }
    this.lastKnownIno = stat.ino;

    if (stat.size === this.lastReadPosition) return;

    let handle;
    try {
      handle = await fs.open(config.logPath, 'r');
      const length = stat.size - this.lastReadPosition;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, this.lastReadPosition);
      this.lastReadPosition = stat.size;

      const lines = buffer.toString('utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = this.parseLine(line);
        if (!parsed) continue;
        if (!callback(parsed)) this.remember(parsed);
        this.checkForPlayerEvents(parsed);
      }
    } catch (error) {
      console.error('Error reading log delta:', error);
    } finally {
      await handle?.close();
    }
  }

  private parseLine(line: string): LogLine | null {
    if (!line.trim()) return null;

    // Standard Minecraft log format: "[HH:MM:SS] [Source/LEVEL]: Message"
    const match = line.match(/^\[(\d{1,2}:\d{2}:\d{2})\]\s*\[([^\]]*)\]:\s*(.*)$/);
    if (match) {
      const [, timestamp, source, message] = match;
      const sourceLevel = source.split('/').pop()?.toUpperCase() ?? '';
      let level: LogLine['level'] = 'INFO';
      if (sourceLevel === 'ERROR' || sourceLevel === 'WARN' || sourceLevel === 'DEBUG') {
        level = sourceLevel;
      }
      return { timestamp, level, message, source };
    }

    // Forge log format: "[DateTimeWithMs] [Thread/LEVEL] [Mod/]: Message"
    // Strip the first two brackets; keep the mod bracket as part of the visible message.
    const forgeMatch = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(\[[^\]]*\]:.*)$/);
    if (forgeMatch) {
      const [, timestamp, threadLevel, message] = forgeMatch;
      const upper = threadLevel.split('/').pop()?.toUpperCase() ?? '';
      let level: LogLine['level'] = 'INFO';
      if (upper === 'ERROR' || upper === 'WARN' || upper === 'DEBUG') {
        level = upper as LogLine['level'];
      }
      return { timestamp, level, message, source: threadLevel };
    }

    // Fallback for non-standard lines: keep the whole line as the message.
    let level: LogLine['level'] = 'INFO';
    if (line.includes('ERROR')) level = 'ERROR';
    else if (line.includes('WARN')) level = 'WARN';
    else if (line.includes('DEBUG')) level = 'DEBUG';

    return { timestamp: '', level, message: line.trim() };
  }

  private checkForPlayerEvents(logLine: LogLine): void {
    if (!this.playerManager || !this.onPlayersUpdate) return;

    // Forge messages include a mod bracket prefix: "[net.minecraft.server.MinecraftServer/]: "
    const msg = logLine.message.replace(/^\[[^\]]*\]:\s*/, '');

    // Reply to `list`: "There are 2 of a max of 20 players online: Alice, Bob"
    const listMatch = msg.match(/^There are \d+ (?:of a max of|\/) ?\d+ players online:\s*(.*)$/);
    if (listMatch) {
      const names = listMatch[1].split(',').map((n) => n.trim()).filter(Boolean);
      this.playerManager.syncOnline(names);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
      return;
    }

    const joinMatch = msg.match(/^(.+?)\s+joined the game$/);
    if (joinMatch) {
      this.playerManager.trackPlayerJoin(joinMatch[1]);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
      return;
    }

    const leaveMatch = msg.match(/^(.+?)\s+left the game$/);
    if (leaveMatch) {
      this.playerManager.trackPlayerLeave(leaveMatch[1]);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
    }
  }
}

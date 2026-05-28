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

type LineCallback = (line: LogLine) => void;
type PlayersCallback = (players: Player[]) => void;

export class ConsoleManager {
  private lastReadPosition = 0;
  private lastKnownIno: number | null = null;
  private playerManager: PlayerManager | null = null;
  private onPlayersUpdate: PlayersCallback | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private polling = false;

  async getLogs(limit: number = 50): Promise<LogLine[]> {
    const bounded = Math.max(1, Math.min(limit, config.maxConsoleLogLimit));
    try {
      const content = await fs.readFile(config.logPath, 'utf-8');
      const logLines: LogLine[] = [];

      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        const parsed = this.parseLine(line);
        if (parsed) logLines.push(parsed);
      }

      return logLines.slice(-bounded);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      console.error('Error reading logs:', error);
      return [];
    }
  }

  setPlayerManager(playerManager: PlayerManager, onPlayersUpdate: PlayersCallback): void {
    this.playerManager = playerManager;
    this.onPlayersUpdate = onPlayersUpdate;
  }

  async watchLogs(callback: LineCallback): Promise<void> {
    if (this.pollTimer) return;

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
        callback(parsed);
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
      return { timestamp, level, message };
    }

    // Forge log format: "[DateTimeWithMs] [Thread/LEVEL] [Source]: Message"
    const forgeMatch = line.match(/^\[[^\]]+\]\s+\[[^\]]+\/([^\]]+)\]\s+\[[^\]]*\]:\s*(.*)$/);
    if (forgeMatch) {
      const [, sourceLevel, message] = forgeMatch;
      const upper = sourceLevel.toUpperCase();
      let level: LogLine['level'] = 'INFO';
      if (upper === 'ERROR' || upper === 'WARN' || upper === 'DEBUG') {
        level = upper as LogLine['level'];
      }
      return { timestamp: '', level, message };
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

    const joinMatch = logLine.message.match(/^(.+?)\s+joined the game$/);
    if (joinMatch) {
      this.playerManager.trackPlayerJoin(joinMatch[1]);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
      return;
    }

    const leaveMatch = logLine.message.match(/^(.+?)\s+left the game$/);
    if (leaveMatch) {
      this.playerManager.trackPlayerLeave(leaveMatch[1]);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
    }
  }
}

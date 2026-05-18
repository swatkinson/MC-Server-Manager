import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { LogLine, Player } from '../types/index.js';
import { PlayerManager } from './PlayerManager.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

const COMMAND_REGEX = /^[A-Za-z0-9 _.\-:/@!?'"=,()\[\]{}+*]+$/;

export function isValidCommand(command: string): boolean {
  if (!command || typeof command !== 'string') return false;
  const trimmed = command.trim();
  return trimmed.length > 0 && trimmed.length <= 500 && COMMAND_REGEX.test(trimmed);
}

type LineCallback = (line: LogLine) => void;
type PlayersCallback = (players: Player[]) => void;

export class ConsoleManager {
  private lastReadPosition = 0;
  private playerManager: PlayerManager | null = null;
  private onPlayersUpdate: PlayersCallback | null = null;
  private watcher: FSWatcher | null = null;

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
    if (this.watcher) return;

    try {
      const content = await fs.readFile(config.logPath, 'utf-8').catch(() => '');
      this.lastReadPosition = content.length;
    } catch (error) {
      console.error('Error initializing log watcher:', error);
    }

    try {
      this.watcher = watch(config.logPath, async (eventType) => {
        if (eventType !== 'change') return;
        try {
          const content = await fs.readFile(config.logPath, 'utf-8');
          if (content.length < this.lastReadPosition) {
            this.lastReadPosition = 0;
          }
          const newContent = content.slice(this.lastReadPosition);
          this.lastReadPosition = content.length;

          for (const line of newContent.split('\n')) {
            if (!line.trim()) continue;
            const parsed = this.parseLine(line);
            if (!parsed) continue;
            callback(parsed);
            this.checkForPlayerEvents(parsed);
          }
        } catch (error) {
          console.error('Error reading log change:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up log watcher:', error);
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  async executeCommand(command: string): Promise<string> {
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

      await new Promise((resolve) => setTimeout(resolve, 500));

      const logs = await this.getLogs(5);
      return logs.map((log) => log.message).join('\n');
    } catch (error) {
      console.error('Error executing command:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute command: ${message}`);
    }
  }

  private parseLine(line: string): LogLine | null {
    if (!line.trim()) return null;

    const timestamp = line.substring(0, 12);

    let level: LogLine['level'] = 'INFO';
    if (line.includes('[ERROR]') || line.includes('ERROR')) level = 'ERROR';
    else if (line.includes('[WARN]') || line.includes('WARN')) level = 'WARN';
    else if (line.includes('[DEBUG]') || line.includes('DEBUG')) level = 'DEBUG';

    const message = line.substring(13).trim();
    return { timestamp, level, message };
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

import * as fs from 'fs/promises';
import { watch } from 'fs';
import * as path from 'path';
import { LogLine } from '../types/index.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PlayerManager } from './PlayerManager.js';

const execFileAsync = promisify(execFile);

export class ConsoleManager {
  private minecraftDir = process.env.MINECRAFT_DIR || `${process.env.HOME}/MinecraftServer`;
  private logPath = path.join(this.minecraftDir, 'logs', 'latest.log');
  private logLineBuffer: LogLine[] = [];
  private lastReadPosition = 0;
  private playerManager: PlayerManager | null = null;
  private onPlayersUpdate: ((players: any[]) => void) | null = null;

  async getLogs(limit: number = 50): Promise<LogLine[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.split('\n');
      const logLines: LogLine[] = [];

      for (const line of lines) {
        if (line.trim()) {
          const parsed = this.parseLine(line);
          if (parsed) {
            logLines.push(parsed);
          }
        }
      }

      return logLines.slice(-limit);
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }

  setPlayerManager(playerManager: PlayerManager, onPlayersUpdate: (players: any[]) => void): void {
    this.playerManager = playerManager;
    this.onPlayersUpdate = onPlayersUpdate;
  }

  async watchLogs(callback: (line: LogLine) => void): Promise<void> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      this.lastReadPosition = content.length;

      watch(this.logPath, async (eventType: string) => {
        if (eventType === 'change') {
          try {
            const content = await fs.readFile(this.logPath, 'utf-8');
            const newContent = content.slice(this.lastReadPosition);
            this.lastReadPosition = content.length;

            const lines = newContent.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const parsed = this.parseLine(line);
                if (parsed) {
                  callback(parsed);
                  this.checkForPlayerEvents(parsed);
                }
              }
            }
          } catch (error) {
            console.error('Error watching logs:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error setting up log watcher:', error);
    }

    return new Promise(() => {
      // Keep watching indefinitely
    });
  }

  async executeCommand(command: string): Promise<string> {
    try {
      execFile('screen', ['-S', 'minecraft', '-X', 'stuff', `${command}\n`]);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const logs = await this.getLogs(5);
      return logs.map((log) => log.message).join('\n');
    } catch (error) {
      return `Error executing command: ${error}`;
    }
  }

  private parseLine(line: string): LogLine | null {
    try {
      const timestamp = line.substring(0, 12);

      let level: LogLine['level'] = 'INFO';
      if (line.includes('[ERROR]') || line.includes('ERROR')) {
        level = 'ERROR';
      } else if (line.includes('[WARN]') || line.includes('WARN')) {
        level = 'WARN';
      } else if (line.includes('[DEBUG]') || line.includes('DEBUG')) {
        level = 'DEBUG';
      }

      const message = line.substring(13).trim();

      return { timestamp, level, message };
    } catch {
      return null;
    }
  }

  private checkForPlayerEvents(logLine: LogLine): void {
    if (!this.playerManager || !this.onPlayersUpdate) {
      return;
    }

    const message = logLine.message;

    // Detect player join pattern: "PlayerName joined the game"
    const joinMatch = message.match(/^(.+?)\s+joined the game$/);
    if (joinMatch) {
      const playerName = joinMatch[1];
      this.playerManager.trackPlayerJoin(playerName);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
      return;
    }

    // Detect player leave pattern: "PlayerName left the game"
    const leaveMatch = message.match(/^(.+?)\s+left the game$/);
    if (leaveMatch) {
      const playerName = leaveMatch[1];
      this.playerManager.trackPlayerLeave(playerName);
      this.onPlayersUpdate(this.playerManager.getOnlinePlayers());
      return;
    }
  }
}

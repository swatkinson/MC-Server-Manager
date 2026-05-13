import { Player } from '../types/index.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class PlayerManager {
  private playerJoinTimes: Map<string, number> = new Map();

  async getPlayerList(): Promise<Player[]> {
    try {
      // Execute the /list command in Minecraft server
      // This will parse the output and return player information
      execFile('screen', ['-S', 'minecraft', '-X', 'stuff', 'list\n']);

      // Give the server a moment to process the command
      await new Promise((resolve) => setTimeout(resolve, 300));

      // In a real implementation, we'd parse the server logs to extract player list
      // For now, we'll return an empty array as a placeholder
      return this.parsePlayersFromLogs();
    } catch (error) {
      console.error('Error getting player list:', error);
      return [];
    }
  }

  /**
   * Parse player information from recent server logs
   * Minecraft logs have patterns like:
   * "[HH:MM:SS] [Server thread/INFO]: Player joined the game"
   * "[HH:MM:SS] [Server thread/INFO]: Player left the game"
   */
  private parsePlayersFromLogs(): Player[] {
    // This would be populated by parsing the actual logs
    // For the MVP, we track joins/leaves from console output
    const players: Player[] = [];

    // Sort by join time (most recent first)
    const sortedEntries = Array.from(this.playerJoinTimes.entries())
      .sort(([, timeA], [, timeB]) => timeB - timeA);

    for (const [playerName, joinTime] of sortedEntries) {
      players.push({
        uuid: this.generateUUID(playerName),
        name: playerName,
        ip: '0.0.0.0', // Would need actual IP from logs
        joinTime,
        isOp: false, // Would need to check ops.json
      });
    }

    return players;
  }

  /**
   * Track player join time from log parsing
   */
  trackPlayerJoin(playerName: string): void {
    if (!this.playerJoinTimes.has(playerName)) {
      this.playerJoinTimes.set(playerName, Date.now());
    }
  }

  /**
   * Remove player from tracking when they leave
   */
  trackPlayerLeave(playerName: string): void {
    this.playerJoinTimes.delete(playerName);
  }

  /**
   * Check if a player is currently online
   */
  isPlayerOnline(playerName: string): boolean {
    return this.playerJoinTimes.has(playerName);
  }

  /**
   * Get all online players
   */
  getOnlinePlayers(): Player[] {
    return this.parsePlayersFromLogs();
  }

  /**
   * Generate a pseudo-UUID from player name
   * In production, this would come from the actual game data
   */
  private generateUUID(playerName: string): string {
    // Simple deterministic UUID generation for demo purposes
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
      const char = playerName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const uuid = [
      this.padZero(Math.abs(hash >> 0).toString(16), 8),
      this.padZero(Math.abs(hash >> 8).toString(16), 4),
      this.padZero(Math.abs(hash >> 16).toString(16), 4),
      this.padZero(Math.abs(hash >> 24).toString(16), 4),
      this.padZero(Date.now().toString(16), 12),
    ].join('-');
    return uuid;
  }

  private padZero(str: string, len: number): string {
    return str.padStart(len, '0');
  }
}

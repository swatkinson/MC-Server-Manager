import { Player } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PlayerData {
  joinTime: number;
  isOp: boolean;
}

export class PlayerManager {
  private playerJoinTimes: Map<string, PlayerData> = new Map();
  private minecraftDir = process.env.MINECRAFT_DIR || `${process.env.HOME}/MinecraftServer`;
  private opsPath = path.join(this.minecraftDir, 'ops.json');
  private opsCache: Set<string> = new Set();
  private lastOpsCheckTime = 0;

  async getPlayerList(): Promise<Player[]> {
    try {
      // Refresh ops cache if not recently updated
      if (Date.now() - this.lastOpsCheckTime > 60000) {
        await this.loadOpsCache();
      }

      // Return online players sorted by join time (most recent first)
      const players: Player[] = [];
      const sortedEntries = Array.from(this.playerJoinTimes.entries())
        .sort(([, dataA], [, dataB]) => dataB.joinTime - dataA.joinTime);

      for (const [playerName, playerData] of sortedEntries) {
        players.push({
          uuid: this.generateUUID(playerName),
          name: playerName,
          ip: '0.0.0.0', // IP would need to be extracted from logs
          joinTime: playerData.joinTime,
          isOp: playerData.isOp,
        });
      }

      return players;
    } catch (error) {
      console.error('Error getting player list:', error);
      return [];
    }
  }

  /**
   * Track player join time from log parsing
   */
  trackPlayerJoin(playerName: string): void {
    const isOp = this.opsCache.has(playerName);
    if (!this.playerJoinTimes.has(playerName)) {
      this.playerJoinTimes.set(playerName, {
        joinTime: Date.now(),
        isOp,
      });
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
    const players: Player[] = [];
    const sortedEntries = Array.from(this.playerJoinTimes.entries())
      .sort(([, dataA], [, dataB]) => dataB.joinTime - dataA.joinTime);

    for (const [playerName, playerData] of sortedEntries) {
      players.push({
        uuid: this.generateUUID(playerName),
        name: playerName,
        ip: '0.0.0.0',
        joinTime: playerData.joinTime,
        isOp: playerData.isOp,
      });
    }

    return players;
  }

  /**
   * Load ops from ops.json file
   */
  private async loadOpsCache(): Promise<void> {
    try {
      const content = await fs.readFile(this.opsPath, 'utf-8');
      const ops = JSON.parse(content);

      this.opsCache.clear();
      if (Array.isArray(ops)) {
        // ops.json is an array of objects with 'name' property
        for (const op of ops) {
          if (op.name) {
            this.opsCache.add(op.name);
          }
        }
      }

      this.lastOpsCheckTime = Date.now();
    } catch (error) {
      console.error('Error loading ops.json:', error);
      // If ops.json doesn't exist or is invalid, just continue with empty ops cache
    }
  }

  /**
   * Generate a deterministic UUID from player name
   * In production, this would come from the actual game data
   */
  private generateUUID(playerName: string): string {
    // Create a deterministic pseudo-UUID based on player name
    // Format: 8-4-4-4-12 (standard UUID format)
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
      const char = playerName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const part1 = Math.abs(hash >> 0).toString(16).padStart(8, '0').slice(-8);
    const part2 = Math.abs(hash >> 8).toString(16).padStart(4, '0').slice(-4);
    const part3 = Math.abs(hash >> 16).toString(16).padStart(4, '0').slice(-4);
    const part4 = Math.abs(hash >> 24).toString(16).padStart(4, '0').slice(-4);
    const part5 = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);

    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }
}

import * as fs from 'fs/promises';
import { Player } from '../types/index.js';
import { config } from '../config.js';

interface PlayerData {
  joinTime: number;
  isOp: boolean;
}

const OPS_CACHE_TTL_MS = 60_000;

export class PlayerManager {
  private playerJoinTimes = new Map<string, PlayerData>();
  private opsCache: Set<string> = new Set();
  private lastOpsCheckTime = 0;
  // name (lowercased) → uuid from usercache.json, which the server updates on every login.
  private uuidCache = new Map<string, string>();
  private lastUuidCheckTime = 0;

  async getPlayerList(): Promise<Player[]> {
    await Promise.all([this.refreshOpsCacheIfStale(), this.refreshUuidCacheIfStale()]);
    return this.getOnlinePlayers();
  }

  trackPlayerJoin(playerName: string): void {
    if (this.playerJoinTimes.has(playerName)) return;
    this.playerJoinTimes.set(playerName, {
      joinTime: Date.now(),
      isOp: this.opsCache.has(playerName),
    });
    // New logins are written to usercache.json — pick the UUID up promptly.
    this.lastUuidCheckTime = 0;
    void this.refreshUuidCacheIfStale();
  }

  // Authoritative online list (from a `list` reply): keep known join times,
  // add anyone we missed, drop anyone who's gone.
  syncOnline(names: string[]): void {
    const online = new Set(names);
    for (const name of [...this.playerJoinTimes.keys()]) {
      if (!online.has(name)) this.playerJoinTimes.delete(name);
    }
    for (const name of names) this.trackPlayerJoin(name);
  }

  trackPlayerLeave(playerName: string): void {
    this.playerJoinTimes.delete(playerName);
  }

  isPlayerOnline(playerName: string): boolean {
    return this.playerJoinTimes.has(playerName);
  }

  clearAll(): void {
    this.playerJoinTimes.clear();
  }

  getOnlinePlayers(): Player[] {
    return Array.from(this.playerJoinTimes.entries())
      .sort(([, a], [, b]) => b.joinTime - a.joinTime)
      .map(([name, data]) => ({
        uuid: this.uuidCache.get(name.toLowerCase()) ?? this.generateUUID(name),
        name,
        // Not exposed: player lists are broadcast to every role, including read-only users.
        ip: '',
        joinTime: data.joinTime,
        isOp: data.isOp,
      }));
  }

  private async refreshOpsCacheIfStale(): Promise<void> {
    if (Date.now() - this.lastOpsCheckTime <= OPS_CACHE_TTL_MS) return;

    try {
      const content = await fs.readFile(config.opsPath, 'utf-8');
      const ops = JSON.parse(content);

      this.opsCache.clear();
      if (Array.isArray(ops)) {
        for (const op of ops) {
          if (op && typeof op.name === 'string') {
            this.opsCache.add(op.name);
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error loading ops.json:', error);
      }
    } finally {
      this.lastOpsCheckTime = Date.now();
    }
  }

  private async refreshUuidCacheIfStale(): Promise<void> {
    if (Date.now() - this.lastUuidCheckTime <= OPS_CACHE_TTL_MS) return;
    this.lastUuidCheckTime = Date.now();
    try {
      const entries: unknown = JSON.parse(await fs.readFile(config.userCachePath, 'utf-8'));
      if (!Array.isArray(entries)) return;
      for (const e of entries as Array<{ name?: unknown; uuid?: unknown }>) {
        if (typeof e.name === 'string' && typeof e.uuid === 'string') this.uuidCache.set(e.name.toLowerCase(), e.uuid);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Error loading usercache.json:', error);
    }
  }

  // Deterministic pseudo-UUID derived from the player name — only used until
  // the player shows up in usercache.json.
  private generateUUID(playerName: string): string {
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
      hash = ((hash << 5) - hash + playerName.charCodeAt(i)) | 0;
    }
    const part1 = Math.abs(hash >> 0).toString(16).padStart(8, '0').slice(-8);
    const part2 = Math.abs(hash >> 8).toString(16).padStart(4, '0').slice(-4);
    const part3 = Math.abs(hash >> 16).toString(16).padStart(4, '0').slice(-4);
    const part4 = Math.abs(hash >> 24).toString(16).padStart(4, '0').slice(-4);
    const part5 = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }
}

import * as fs from 'fs/promises';
import { ServerConfig, WhitelistEntry } from '../types/index.js';
import { config } from '../config.js';

type Result = { success: boolean; message: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(uuid: string): boolean {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

export class ConfigManager {
  async getServerProperties(): Promise<ServerConfig> {
    const defaults: ServerConfig = {
      motd: '',
      levelName: '',
      maxPlayers: 20,
      difficulty: 'easy',
      gameMode: 'survival',
    };

    try {
      const content = await fs.readFile(config.serverPropertiesPath, 'utf-8');
      const properties: ServerConfig = { ...defaults };

      for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq);
        const value = line.slice(eq + 1);
        properties[key] = this.parseValue(value);
      }

      return properties;
    } catch (error) {
      console.error('Error reading server properties:', error);
      return defaults;
    }
  }

  async setServerProperties(properties: ServerConfig): Promise<Result> {
    try {
      const merged = { ...(await this.getServerProperties()), ...properties };
      const lines = Object.entries(merged)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`);

      await fs.writeFile(config.serverPropertiesPath, lines.join('\n'), 'utf-8');
      return { success: true, message: 'Server properties updated' };
    } catch (error) {
      console.error('Error updating server properties:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error updating server properties: ${message}` };
    }
  }

  async getWhitelist(): Promise<WhitelistEntry[]> {
    try {
      const content = await fs.readFile(config.whitelistPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry): entry is WhitelistEntry =>
          entry && typeof entry.uuid === 'string' && typeof entry.name === 'string',
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      console.error('Error reading whitelist:', error);
      return [];
    }
  }

  async addToWhitelist(uuid: string, name: string): Promise<Result> {
    if (!isValidUuid(uuid)) {
      return { success: false, message: 'Invalid UUID format' };
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { success: false, message: 'Player name is required' };
    }

    try {
      const whitelist = await this.getWhitelist();
      if (whitelist.some((entry) => entry.uuid.toLowerCase() === uuid.toLowerCase())) {
        return { success: false, message: 'Player already in whitelist' };
      }

      whitelist.push({ uuid, name });
      await fs.writeFile(config.whitelistPath, JSON.stringify(whitelist, null, 2), 'utf-8');
      return { success: true, message: 'Player added to whitelist' };
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error adding player to whitelist: ${message}` };
    }
  }

  async removeFromWhitelist(uuid: string): Promise<Result> {
    if (!isValidUuid(uuid)) {
      return { success: false, message: 'Invalid UUID format' };
    }

    try {
      const whitelist = await this.getWhitelist();
      const filtered = whitelist.filter((entry) => entry.uuid.toLowerCase() !== uuid.toLowerCase());

      if (filtered.length === whitelist.length) {
        return { success: false, message: 'Player not found in whitelist' };
      }

      await fs.writeFile(config.whitelistPath, JSON.stringify(filtered, null, 2), 'utf-8');
      return { success: true, message: 'Player removed from whitelist' };
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error removing player from whitelist: ${message}` };
    }
  }

  async setWhitelist(entries: WhitelistEntry[]): Promise<Result> {
    if (!Array.isArray(entries)) {
      return { success: false, message: 'Entries must be an array' };
    }

    const invalid = entries.find((entry) => !entry || !isValidUuid(entry.uuid) || !entry.name);
    if (invalid) {
      return { success: false, message: 'One or more entries have invalid uuid or name' };
    }

    try {
      const normalized = entries.map(({ uuid, name }) => ({ uuid, name }));
      await fs.writeFile(config.whitelistPath, JSON.stringify(normalized, null, 2), 'utf-8');
      return { success: true, message: 'Whitelist updated' };
    } catch (error) {
      console.error('Error updating whitelist:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error updating whitelist: ${message}` };
    }
  }

  async isWhitelistEnabled(): Promise<boolean> {
    try {
      const properties = await this.getServerProperties();
      const value = properties['enforce-whitelist'];
      return value === true || value === 'true';
    } catch {
      return false;
    }
  }

  async setWhitelistEnabled(enabled: boolean): Promise<Result> {
    try {
      const properties = await this.getServerProperties();
      properties['enforce-whitelist'] = enabled;
      return this.setServerProperties(properties);
    } catch (error) {
      console.error('Error setting whitelist enabled:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error setting whitelist enabled: ${message}` };
    }
  }

  private parseValue(value: string): string | number | boolean {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed);
    return trimmed;
  }
}

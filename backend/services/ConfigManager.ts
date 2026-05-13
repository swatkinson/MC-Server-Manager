import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerConfig } from '../types/index.js';

export class ConfigManager {
  private minecraftDir = process.env.MINECRAFT_DIR || `${process.env.HOME}/MinecraftServer`;
  private propsPath = path.join(this.minecraftDir, 'server.properties');
  private whitelistPath = path.join(this.minecraftDir, 'whitelist.json');

  async getServerProperties(): Promise<ServerConfig> {
    try {
      const content = await fs.readFile(this.propsPath, 'utf-8');
      const config: ServerConfig = { motd: '', levelName: '', maxPlayers: 20, difficulty: 'easy', gameMode: 'survival' };

      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key) {
            const value = valueParts.join('=');
            config[key] = this.parseValue(value);
          }
        }
      });

      return config;
    } catch (error) {
      console.error('Error reading server properties:', error);
      return { motd: '', levelName: '', maxPlayers: 20, difficulty: 'easy', gameMode: 'survival' };
    }
  }

  async setServerProperties(config: ServerConfig): Promise<{ success: boolean; message: string }> {
    try {
      const currentConfig = await this.getServerProperties();
      const merged = { ...currentConfig, ...config };

      const lines: string[] = [];
      for (const [key, value] of Object.entries(merged)) {
        if (value !== undefined && value !== null) {
          lines.push(`${key}=${value}`);
        }
      }

      await fs.writeFile(this.propsPath, lines.join('\n'), 'utf-8');
      return { success: true, message: 'Server properties updated' };
    } catch (error) {
      return { success: false, message: `Error updating server properties: ${error}` };
    }
  }

  async getWhitelist(): Promise<Array<{ uuid: string; name: string }>> {
    try {
      const content = await fs.readFile(this.whitelistPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading whitelist:', error);
      return [];
    }
  }

  async addToWhitelist(uuid: string, name: string): Promise<{ success: boolean; message: string }> {
    try {
      const whitelist = await this.getWhitelist();
      if (whitelist.some((entry) => entry.uuid === uuid)) {
        return { success: false, message: 'Player already in whitelist' };
      }

      whitelist.push({ uuid, name });
      await fs.writeFile(this.whitelistPath, JSON.stringify(whitelist, null, 2), 'utf-8');
      return { success: true, message: 'Player added to whitelist' };
    } catch (error) {
      return { success: false, message: `Error adding player to whitelist: ${error}` };
    }
  }

  async removeFromWhitelist(uuid: string): Promise<{ success: boolean; message: string }> {
    try {
      let whitelist = await this.getWhitelist();
      const before = whitelist.length;
      whitelist = whitelist.filter((entry) => entry.uuid !== uuid);

      if (whitelist.length === before) {
        return { success: false, message: 'Player not found in whitelist' };
      }

      await fs.writeFile(this.whitelistPath, JSON.stringify(whitelist, null, 2), 'utf-8');
      return { success: true, message: 'Player removed from whitelist' };
    } catch (error) {
      return { success: false, message: `Error removing player from whitelist: ${error}` };
    }
  }

  async setWhitelist(entries: Array<{ uuid: string; name: string }>): Promise<{ success: boolean; message: string }> {
    try {
      await fs.writeFile(this.whitelistPath, JSON.stringify(entries, null, 2), 'utf-8');
      return { success: true, message: 'Whitelist updated' };
    } catch (error) {
      return { success: false, message: `Error updating whitelist: ${error}` };
    }
  }

  async isWhitelistEnabled(): Promise<boolean> {
    try {
      const config = await this.getServerProperties();
      return config['enforce-whitelist'] === true || config['enforce-whitelist'] === 'true';
    } catch (error) {
      return false;
    }
  }

  async setWhitelistEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getServerProperties();
      config['enforce-whitelist'] = enabled;
      const result = await this.setServerProperties(config);
      return result;
    } catch (error) {
      return { success: false, message: `Error setting whitelist enabled: ${error}` };
    }
  }

  private parseValue(value: string): string | number | boolean {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
    return trimmed;
  }
}

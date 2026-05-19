import * as fs from 'fs/promises';
import { ServerInfo, ServerType } from '../types/index.js';
import { config } from '../config.js';

const DEFAULTS: ServerInfo = {
  version: 'unknown',
  serverType: 'unknown',
  updatedAt: 0,
};

export class ServerInfoStore {
  async read(): Promise<ServerInfo | null> {
    try {
      const content = await fs.readFile(config.serverInfoPath, 'utf-8');
      return JSON.parse(content) as ServerInfo;
    } catch {
      return null;
    }
  }

  async write(partial: Partial<Omit<ServerInfo, 'updatedAt'>>): Promise<void> {
    await fs.mkdir(config.serverManagerDir, { recursive: true });
    const existing = (await this.read()) ?? DEFAULTS;
    const updated: ServerInfo = { ...existing, ...partial, updatedAt: Date.now() };
    await fs.writeFile(config.serverInfoPath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  async getVersion(): Promise<string> {
    return (await this.read())?.version ?? 'unknown';
  }

  async getServerType(): Promise<ServerType> {
    return (await this.read())?.serverType ?? 'unknown';
  }
}

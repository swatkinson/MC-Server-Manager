import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import type { User } from '../types/index.js';

export class UserStore {
  private readonly filePath = config.usersPath;
  private pendingWrite: Promise<void> = Promise.resolve();

  async getAll(): Promise<User[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as User[];
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.id === id) ?? null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.username === username) ?? null;
  }

  async create(username: string, passwordHash: string, role: 'admin' | 'moderator' | 'user' = 'user'): Promise<User> {
    const users = await this.getAll();
    const user: User = {
      id: randomUUID(),
      username,
      passwordHash,
      role,
      createdAt: Date.now(),
    };
    users.push(user);
    await this.write(users);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    const users = await this.getAll();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return false;
    await this.write(filtered);
    return true;
  }

  async count(): Promise<number> {
    return (await this.getAll()).length;
  }

  async isEmpty(): Promise<boolean> {
    return (await this.count()) === 0;
  }

  private async write(users: User[]): Promise<void> {
    this.pendingWrite = this.pendingWrite.then(() =>
      fs.writeFile(this.filePath, JSON.stringify(users, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      }),
    );
    return this.pendingWrite;
  }
}

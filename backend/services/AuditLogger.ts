import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string | null;
  username: string | null;
  role: 'admin' | 'moderator' | 'user' | null;
  action: string;
  details: Record<string, unknown>;
}

export class AuditLogger {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  async log(
    user: { sub: string; username: string; role: string } | null,
    action: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const entry: AuditEntry = {
        id: randomUUID(),
        timestamp: Date.now(),
        userId: user?.sub ?? null,
        username: user?.username ?? null,
        role: (user?.role as 'admin' | 'moderator' | 'user' | null) ?? null,
        action,
        details,
      };
      await fs.appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch (err) {
      console.error('[AuditLogger] Failed to write audit entry:', err);
    }
  }

  async getEntries(limit: number, offset: number): Promise<{ entries: AuditEntry[]; total: number }> {
    let raw: string;
    try {
      raw = await fs.readFile(this.logPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { entries: [], total: 0 };
      }
      throw err;
    }

    const lines = raw.split('\n');
    const parsed: AuditEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        parsed.push(JSON.parse(trimmed) as AuditEntry);
      } catch {
        // skip malformed lines
      }
    }

    parsed.reverse();

    const total = parsed.length;
    const entries = parsed.slice(offset, offset + limit);

    return { entries, total };
  }
}

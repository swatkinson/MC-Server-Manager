import * as fs from 'fs/promises';
import { PortForwardCheckResult } from '../types/index.js';
import { config } from '../config.js';

const DEFAULT_PORT = 25565;
const FETCH_TIMEOUT_MS = 8_000;
// Delay between server start and the port-forward check, to give the JVM time
// to bind to the listening socket.
const STARTUP_CHECK_DELAY_MS = 30_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readServerPort(): Promise<number> {
  try {
    const content = await fs.readFile(config.serverPropertiesPath, 'utf-8');
    const match = content.match(/^server-port=(\d+)/m);
    if (!match) return DEFAULT_PORT;
    const port = parseInt(match[1], 10);
    return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

async function fetchPublicIp(): Promise<string | null> {
  try {
    const data = (await fetchJson('https://api.ipify.org?format=json')) as { ip?: string };
    return typeof data?.ip === 'string' && data.ip.length > 0 ? data.ip : null;
  } catch {
    return null;
  }
}

export class PortForwardChecker {
  async getPublicIp(): Promise<string | null> {
    return fetchPublicIp();
  }
  private inFlight = false;
  private startupCheckTimer: NodeJS.Timeout | null = null;

  async check(): Promise<PortForwardCheckResult> {
    if (this.inFlight) {
      return {
        ok: null,
        publicIp: null,
        port: await readServerPort(),
        checkedAt: Date.now(),
        message: 'A port-forward check is already running.',
      };
    }
    this.inFlight = true;
    const port = await readServerPort();
    try {
      const publicIp = await fetchPublicIp();
      if (!publicIp) {
        return {
          ok: null,
          publicIp: null,
          port,
          checkedAt: Date.now(),
          message: 'Could not determine public IP (api.ipify.org unreachable).',
        };
      }
      const probe = (await fetchJson(
        `https://api.mcsrvstat.us/3/${encodeURIComponent(publicIp)}:${port}`,
      )) as { online?: boolean; debug?: { ping?: boolean; query?: boolean } };
      const online =
        probe?.online === true || probe?.debug?.ping === true || probe?.debug?.query === true;
      return {
        ok: online,
        publicIp,
        port,
        checkedAt: Date.now(),
        message: online
          ? `Server is reachable at ${publicIp}:${port}.`
          : `Server is not reachable at ${publicIp}:${port}. Check router port forwarding for TCP ${port}.`,
      };
    } catch (error) {
      return {
        ok: null,
        publicIp: null,
        port,
        checkedAt: Date.now(),
        message:
          'Could not verify port forwarding (mcsrvstat.us unreachable). The check may be blocked by network policy.',
      };
    } finally {
      this.inFlight = false;
    }
  }

  scheduleStartupCheck(onResult: (result: PortForwardCheckResult) => void): void {
    if (this.startupCheckTimer) clearTimeout(this.startupCheckTimer);
    this.startupCheckTimer = setTimeout(async () => {
      this.startupCheckTimer = null;
      try {
        onResult(await this.check());
      } catch (error) {
        console.error('Port-forward check failed:', error);
      }
    }, STARTUP_CHECK_DELAY_MS);
  }

  cancelStartupCheck(): void {
    if (this.startupCheckTimer) {
      clearTimeout(this.startupCheckTimer);
      this.startupCheckTimer = null;
    }
  }
}

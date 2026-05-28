import * as fs from 'fs/promises';
import * as path from 'path';

export interface DiscordWebhookConfig {
  webhookUrl: string;
  enabled: boolean;
  events: {
    serverStart: boolean;
    serverStop: boolean;
    serverCrash: boolean;
    scheduledRestart: boolean;
    backupSuccess: boolean;
    backupFailed: boolean;
  };
}

const DEFAULT_CONFIG: DiscordWebhookConfig = {
  webhookUrl: '',
  enabled: false,
  events: {
    serverStart: true,
    serverStop: true,
    serverCrash: true,
    scheduledRestart: true,
    backupSuccess: true,
    backupFailed: true,
  },
};

// Discord embed colors
const COLOR_GREEN = 0x57f287;
const COLOR_RED = 0xed4245;
const COLOR_YELLOW = 0xfee75c;
const COLOR_BLUE = 0x5865f2;

export class DiscordNotifier {
  private readonly configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async getConfig(): Promise<DiscordWebhookConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DiscordWebhookConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        events: {
          ...DEFAULT_CONFIG.events,
          ...(parsed.events ?? {}),
        },
      };
    } catch {
      return { ...DEFAULT_CONFIG, events: { ...DEFAULT_CONFIG.events } };
    }
  }

  async setConfig(partial: Partial<DiscordWebhookConfig>): Promise<void> {
    if (partial.webhookUrl !== undefined && partial.webhookUrl !== '') {
      const validPrefix =
        partial.webhookUrl.startsWith('https://discord.com/api/webhooks/') ||
        partial.webhookUrl.startsWith('https://discordapp.com/api/webhooks/');
      if (!validPrefix) {
        throw new Error('webhookUrl must be a Discord webhook URL (https://discord.com/api/webhooks/...)');
      }
    }
    const current = await this.getConfig();
    const updated: DiscordWebhookConfig = {
      ...current,
      ...partial,
      events: {
        ...current.events,
        ...(partial.events ?? {}),
      },
    };
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  async testWebhook(): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config.webhookUrl) {
      return { success: false, error: 'No webhook URL configured.' };
    }
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'MC Server Manager',
          embeds: [
            {
              title: 'Webhook Test',
              description: 'Your Discord webhook is configured correctly.',
              color: COLOR_BLUE,
              footer: { text: 'MC Server Manager' },
            },
          ],
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Discord returned ${response.status}: ${text}` };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async notify(
    eventKey: keyof DiscordWebhookConfig['events'],
    title: string,
    description: string,
    color: number,
    mention?: boolean,
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled || !config.webhookUrl) return;
    if (!config.events[eventKey]) return;

    try {
      const body: {
        username: string;
        content?: string;
        embeds: Array<{ title: string; description: string; color: number; footer: { text: string } }>;
      } = {
        username: 'MC Server Manager',
        embeds: [
          {
            title,
            description,
            color,
            footer: { text: 'MC Server Manager' },
          },
        ],
      };

      if (mention) {
        body.content = '@everyone';
      }

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[DiscordNotifier] Failed to send notification (${response.status}): ${text}`);
      }
    } catch (err) {
      console.error('[DiscordNotifier] Error sending notification:', err);
    }
  }

  async onServerStart(): Promise<void> {
    await this.notify(
      'serverStart',
      'Server Online',
      'The Minecraft server has started.',
      COLOR_GREEN,
    );
  }

  async onServerStop(): Promise<void> {
    await this.notify(
      'serverStop',
      'Server Offline',
      'The server has stopped.',
      COLOR_YELLOW,
    );
  }

  async onServerCrash(details?: string): Promise<void> {
    await this.notify(
      'serverCrash',
      'Server Crashed',
      `The server has crashed unexpectedly.${details ? '\n' + details : ''}`,
      COLOR_RED,
      true,
    );
  }

  async onScheduledRestart(): Promise<void> {
    await this.notify(
      'scheduledRestart',
      'Scheduled Restart',
      'The server is restarting as scheduled.',
      COLOR_YELLOW,
    );
  }

  async onRestartComplete(): Promise<void> {
    await this.notify(
      'scheduledRestart',
      'Restart Complete',
      'The server is back online after scheduled restart.',
      COLOR_GREEN,
    );
  }

  async onBackupSuccess(filename: string, sizeBytes: number): Promise<void> {
    const sizeMb = (sizeBytes / 1024 / 1024).toFixed(1);
    await this.notify(
      'backupSuccess',
      'Backup Complete',
      `Backup \`${filename}\` created (${sizeMb} MB).`,
      COLOR_GREEN,
    );
  }

  async onBackupFailed(error: string): Promise<void> {
    await this.notify(
      'backupFailed',
      'Backup Failed',
      `Backup failed: ${error}`,
      COLOR_RED,
      true,
    );
  }
}

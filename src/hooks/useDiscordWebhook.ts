import { useState, useEffect, useCallback } from 'react';
import { extractErrorMessage } from '../utils/apiError';

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

interface UseDiscordWebhookResult {
  config: DiscordWebhookConfig | null;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  saveConfig: (cfg: Partial<DiscordWebhookConfig>) => Promise<void>;
  testWebhook: () => Promise<{ success: boolean; error?: string }>;
  refetch: () => void;
}

function handleUnauthorized(): void {
  window.dispatchEvent(new Event('auth:unauthorized'));
}

export function useDiscordWebhook(): UseDiscordWebhookResult {
  const [config, setConfig] = useState<DiscordWebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await globalThis.fetch('/api/webhooks/config', {
        credentials: 'include',
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch webhook config: ${response.statusText}`);
      }
      const json = (await response.json()) as { config: DiscordWebhookConfig };
      setConfig(json.config);
    } catch (err) {
      console.error('[useDiscordWebhook] fetchConfig error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = useCallback(async (cfg: Partial<DiscordWebhookConfig>): Promise<void> => {
    setSaving(true);
    try {
      const response = await globalThis.fetch('/api/webhooks/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cfg),
      });
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Session expired');
      }
      if (!response.ok) {
        const parsed = await response.json().catch(() => null) as unknown;
        throw new Error(extractErrorMessage(parsed, `Request failed: ${response.statusText}`));
      }
      await fetchConfig();
    } finally {
      setSaving(false);
    }
  }, [fetchConfig]);

  const testWebhook = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setTesting(true);
    try {
      const response = await globalThis.fetch('/api/webhooks/test', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 401) {
        handleUnauthorized();
        return { success: false, error: 'Session expired' };
      }
      const json = (await response.json()) as { success: boolean; error?: string };
      return json;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      setTesting(false);
    }
  }, []);

  return {
    config,
    loading,
    saving,
    testing,
    saveConfig,
    testWebhook,
    refetch: fetchConfig,
  };
}

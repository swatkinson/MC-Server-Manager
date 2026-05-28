import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import { extractErrorMessage } from '../utils/apiError';

export interface BackupConfig {
  backupDir: string;
  schedule: { enabled: boolean; hour: number; minute: number };
  keepCount: number;
}

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: number;
}

interface ConfigResponse {
  config: BackupConfig;
}

interface BackupListResponse {
  backups: BackupInfo[];
}

interface BackupCreateResponse {
  success: boolean;
  error?: string;
  filename?: string;
  sizeBytes?: number;
}

interface BackupActionResponse {
  success: boolean;
  error?: string;
}

function handle401(): void {
  window.dispatchEvent(new Event('auth:unauthorized'));
}

async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  const response = await globalThis.fetch(url, {
    ...init,
    credentials: 'include',
  });

  if (response.status === 401) {
    handle401();
    throw new Error('Session expired');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Request failed: ${response.statusText}`));
  }

  return body as T;
}

export function useBackupManager(): {
  config: BackupConfig | null;
  backups: BackupInfo[];
  loading: boolean;
  saving: boolean;
  creating: boolean;
  restoring: string | null;
  deleting: string | null;
  saveConfig: (cfg: Partial<BackupConfig>) => Promise<void>;
  createBackup: () => Promise<{ success: boolean; error?: string }>;
  restoreBackup: (filename: string) => Promise<{ success: boolean; error?: string }>;
  deleteBackup: (filename: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => void;
} {
  const {
    data: configData,
    loading: configLoading,
    refetch: refetchConfig,
  } = useApi<ConfigResponse>('/api/backups/config');

  const {
    data: backupsData,
    loading: backupsLoading,
    refetch: refetchBackups,
  } = useApi<BackupListResponse>('/api/backups');

  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const saveConfig = useCallback(async (cfg: Partial<BackupConfig>): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch<{ success: boolean }>('/api/backups/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      await refetchConfig();
    } finally {
      setSaving(false);
    }
  }, [refetchConfig]);

  const createBackup = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setCreating(true);
    try {
      const result = await apiFetch<BackupCreateResponse>('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await refetchBackups();
      return { success: result.success, error: result.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setCreating(false);
    }
  }, [refetchBackups]);

  const restoreBackup = useCallback(async (filename: string): Promise<{ success: boolean; error?: string }> => {
    setRestoring(filename);
    try {
      const result = await apiFetch<BackupActionResponse>(`/api/backups/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { success: result.success, error: result.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setRestoring(null);
    }
  }, []);

  const deleteBackup = useCallback(async (filename: string): Promise<{ success: boolean; error?: string }> => {
    setDeleting(filename);
    try {
      const result = await apiFetch<BackupActionResponse>(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      await refetchBackups();
      return { success: result.success, error: result.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setDeleting(null);
    }
  }, [refetchBackups]);

  const refetch = useCallback(() => {
    void refetchConfig();
    void refetchBackups();
  }, [refetchConfig, refetchBackups]);

  return {
    config: configData?.config ?? null,
    backups: backupsData?.backups ?? [],
    loading: configLoading || backupsLoading,
    saving,
    creating,
    restoring,
    deleting,
    saveConfig,
    createBackup,
    restoreBackup,
    deleteBackup,
    refetch,
  };
}

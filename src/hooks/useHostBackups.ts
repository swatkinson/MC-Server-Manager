import { useCallback, useEffect, useState } from 'react';
import type { BackupGatewayConfig, HostBackupStatus } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';
import { extractErrorMessage } from '../utils/apiError';

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
  const parsed: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractErrorMessage(parsed, `Request failed (${res.status})`));
  return parsed as T;
}

export function useHostBackups() {
  const { data, loading, refetch } = useApi<HostBackupStatus>('/api/backups');
  const { on } = useServerSocket();
  const [status, setStatus] = useState<HostBackupStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (data) setStatus(data);
  }, [data]);

  useEffect(() => on<HostBackupStatus>('backups:updated', setStatus), [on]);

  const runBackup = useCallback(async () => {
    setStarting(true);
    try {
      await send<{ success: boolean }>('/api/backups/run', 'POST');
    } finally {
      setStarting(false);
    }
  }, []);

  const restore = useCallback(
    async (filename: string) => {
      setRestoring(filename);
      try {
        return await send<{ success: boolean; keptAs?: string }>(`/api/backups/${encodeURIComponent(filename)}/restore`, 'POST');
      } finally {
        setRestoring(null);
        void refetch();
      }
    },
    [refetch],
  );

  const saveConfig = useCallback(
    async (cfg: Partial<BackupGatewayConfig>) => {
      await send<BackupGatewayConfig>('/api/backups/config', 'PUT', cfg);
      await refetch();
    },
    [refetch],
  );

  return { status, loading, refetch, runBackup, starting, restore, restoring, saveConfig };
}

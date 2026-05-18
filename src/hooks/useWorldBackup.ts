import { useState, useCallback } from 'react';
import { useToasts } from '../context/ToastContext';

interface WorldBackupProgress {
  status: 'idle' | 'loading' | 'downloading' | 'error' | 'complete';
  progress: number;
  error: string | null;
}

interface UseWorldBackupReturn {
  status: WorldBackupProgress['status'];
  progress: number;
  error: string | null;
  downloadWorldBackup: () => Promise<void>;
  reset: () => void;
}

export function useWorldBackup(): UseWorldBackupReturn {
  const [backupState, setBackupState] = useState<WorldBackupProgress>({
    status: 'idle',
    progress: 0,
    error: null,
  });
  const { push } = useToasts();

  const downloadWorldBackup = useCallback(async () => {
    try {
      setBackupState({ status: 'loading', progress: 0, error: null });

      const response = await fetch('/api/server/world-backup', { method: 'POST' });

      if (!response.ok) {
        let serverMessage = response.statusText;
        try {
          const body = await response.json();
          if (body?.error) serverMessage = body.error;
        } catch {
          // not JSON; keep statusText
        }
        throw new Error(serverMessage);
      }

      setBackupState({ status: 'downloading', progress: 50, error: null });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `world-backup-${new Date().toISOString().split('T')[0]}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupState({ status: 'complete', progress: 100, error: null });
      push({
        kind: 'success',
        title: 'World backup ready',
        message: 'Download started.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setBackupState({ status: 'error', progress: 0, error: errorMessage });
      push({
        kind: 'error',
        title: 'World backup failed',
        message: errorMessage,
      });
      throw err;
    }
  }, [push]);

  const reset = useCallback(() => {
    setBackupState({ status: 'idle', progress: 0, error: null });
  }, []);

  return {
    status: backupState.status,
    progress: backupState.progress,
    error: backupState.error,
    downloadWorldBackup,
    reset,
  };
}

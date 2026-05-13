import { useState, useCallback } from 'react';

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

  const downloadWorldBackup = useCallback(async () => {
    try {
      setBackupState({ status: 'loading', progress: 0, error: null });

      // Request the backup to be created
      const response = await fetch('/api/server/world-backup', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to create backup: ${response.statusText}`);
      }

      setBackupState({ status: 'downloading', progress: 50, error: null });

      // Get the backup file
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setBackupState({
        status: 'error',
        progress: 0,
        error: errorMessage,
      });
      throw err;
    }
  }, []);

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

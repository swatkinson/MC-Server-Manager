import { useState, useEffect, useCallback } from 'react';
import { LogLine, ConsoleLogsResponse } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';

export function useConsoleLogs(limit: number = 100) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data, loading: apiLoading, error: apiError, refetch } = useApi<ConsoleLogsResponse>(
    `/api/console/logs?limit=${limit}`,
    { manual: false }
  );

  const { connected, on } = useServerSocket();

  // Initial load from API
  useEffect(() => {
    if (data?.logs) {
      setLogs(data.logs);
      setLoading(apiLoading);
      setError(apiError);
    }
  }, [data, apiLoading, apiError]);

  // Listen for new console lines via WebSocket
  useEffect(() => {
    const unsubscribe = on('console:line', (newLine: LogLine) => {
      setLogs((prevLogs) => {
        const updated = [...prevLogs, newLine];
        // Keep only the last `limit` logs
        return updated.slice(-limit);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [on, limit]);

  // Fallback polling if WebSocket is disconnected
  useEffect(() => {
    if (!connected) {
      const pollInterval = setInterval(() => {
        refetch();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(pollInterval);
    }
  }, [connected, refetch]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    loading,
    error,
    clearLogs,
    refetch,
    connected,
  };
}

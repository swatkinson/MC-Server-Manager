import { useEffect } from 'react';
import { ServerStatus } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';

export function useServerStatus() {
  const { data: status, loading, error, refetch } = useApi<ServerStatus>(
    '/api/server/status',
    { interval: 2000 },
  );
  const { on } = useServerSocket();

  useEffect(() => {
    const unsubscribe = on<ServerStatus>('server:status:changed', () => {
      refetch();
    });
    return () => {
      unsubscribe?.();
    };
  }, [on, refetch]);

  return { status: status ?? null, loading, error, refetch };
}

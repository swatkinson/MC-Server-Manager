import { useEffect, useState, useCallback } from 'react';
import { ServerStatus } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';

export function useServerStatus() {
  const { data: status, loading, error, refetch } = useApi<ServerStatus>(
    '/api/server/status',
    { interval: 2000 }
  );
  const { on } = useServerSocket();

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    const unsubscribe = on('server:status:changed', (newStatus: ServerStatus) => {
      // The status will be automatically updated via the polling interval
      // This ensures we get immediate updates when status changes
      refetch();
    });

    return () => {
      unsubscribe?.();
    };
  }, [on, refetch]);

  return { status, loading, error, refetch };
}

import { useEffect, useState, useCallback } from 'react';
import { SystemMetrics } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';

export function useMetrics() {
  const { data, loading, error, refetch } = useApi<SystemMetrics>('/api/metrics', {
    interval: 5000, // Fallback polling interval (5 seconds)
  });
  const { on } = useServerSocket();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(data);

  // Update metrics from API fetch
  useEffect(() => {
    if (data) {
      setMetrics(data);
    }
  }, [data]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribe = on('metrics:updated', (updatedMetrics: SystemMetrics) => {
      setMetrics(updatedMetrics);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [on]);

  return { metrics, loading, error, refetch };
}

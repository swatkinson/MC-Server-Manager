import React, { createContext, useContext } from 'react';
import type { ServerStatus, SystemMetrics } from '../types/api';
import { useMetrics } from '../hooks/useMetrics';
import { useServerStatus } from '../hooks/useServerStatus';

interface ServerDataValue {
  status: ServerStatus | null;
  statusLoading: boolean;
  refetchStatus: () => Promise<void>;
  metrics: SystemMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;
}

const ServerDataContext = createContext<ServerDataValue | null>(null);

// One status poll + one metrics subscription for the whole app shell, instead
// of every widget polling on its own.
export function ServerDataProvider({ children }: { children: React.ReactNode }) {
  const { status, loading: statusLoading, refetch: refetchStatus } = useServerStatus();
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics();
  return (
    <ServerDataContext.Provider value={{ status, statusLoading, refetchStatus, metrics, metricsLoading, metricsError }}>
      {children}
    </ServerDataContext.Provider>
  );
}

export function useServerData(): ServerDataValue {
  const ctx = useContext(ServerDataContext);
  if (!ctx) throw new Error('useServerData must be used inside ServerDataProvider');
  return ctx;
}

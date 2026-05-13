import { useState, useCallback, useEffect } from 'react';
import { useApi, apiPost, apiDelete } from './useApi';
import { useServerSocket } from './useServerSocket';

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface WhitelistData {
  entries: WhitelistEntry[];
  enabled: boolean;
}

interface UseWhitelistReturn {
  entries: WhitelistEntry[];
  enabled: boolean;
  loading: boolean;
  error: string | null;
  updating: boolean;
  addPlayer: (uuid: string, name: string) => Promise<void>;
  removePlayer: (uuid: string) => Promise<void>;
  toggleWhitelist: (enabled: boolean) => Promise<void>;
  refetch: () => void;
}

export function useWhitelist(): UseWhitelistReturn {
  const { data, loading, error, refetch } = useApi<WhitelistData>(
    '/api/config/whitelist',
    { manual: false }
  );
  const { on } = useServerSocket();
  const [updating, setUpdating] = useState(false);
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (data) {
      setEntries(data.entries || []);
      setEnabled(data.enabled || false);
    }
  }, [data]);

  useEffect(() => {
    const unsubscribe = on?.('whitelist:updated', (updatedData: WhitelistData) => {
      setEntries(updatedData.entries || []);
      setEnabled(updatedData.enabled || false);
    });
    return unsubscribe;
  }, [on]);

  const addPlayer = useCallback(async (uuid: string, name: string) => {
    try {
      setUpdating(true);
      const newEntries = [...entries, { uuid, name }];
      await apiPost('/api/config/whitelist', { entries: newEntries });
      setEntries(newEntries);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add player');
    } finally {
      setUpdating(false);
    }
  }, [entries]);

  const removePlayer = useCallback(async (uuid: string) => {
    try {
      setUpdating(true);
      await apiDelete(`/api/config/whitelist/${uuid}`);
      setEntries(entries.filter(e => e.uuid !== uuid));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove player');
    } finally {
      setUpdating(false);
    }
  }, [entries]);

  const toggleWhitelist = useCallback(async (newEnabled: boolean) => {
    try {
      setUpdating(true);
      await apiPost('/api/config/whitelist', {
        entries,
        enabled: newEnabled,
      });
      setEnabled(newEnabled);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to toggle whitelist');
    } finally {
      setUpdating(false);
    }
  }, [entries]);

  return {
    entries,
    enabled,
    loading,
    error: error || null,
    updating,
    addPlayer,
    removePlayer,
    toggleWhitelist,
    refetch,
  };
}

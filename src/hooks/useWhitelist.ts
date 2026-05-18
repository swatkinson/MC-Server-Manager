import { useState, useCallback, useEffect } from 'react';
import { useApi, apiPost, apiDelete } from './useApi';
import { useServerSocket } from './useServerSocket';
import { useToasts } from '../context/ToastContext';

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
  const { push } = useToasts();
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
    setUpdating(true);
    try {
      const newEntries = [...entries, { uuid, name }];
      await apiPost('/api/config/whitelist', { entries: newEntries });
      setEntries(newEntries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add player';
      push({ kind: 'error', title: 'Could not add player to whitelist', message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setUpdating(false);
    }
  }, [entries, push]);

  const removePlayer = useCallback(async (uuid: string) => {
    setUpdating(true);
    try {
      await apiDelete(`/api/config/whitelist/${uuid}`);
      setEntries(entries.filter(e => e.uuid !== uuid));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove player';
      push({ kind: 'error', title: 'Could not remove player from whitelist', message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setUpdating(false);
    }
  }, [entries, push]);

  const toggleWhitelist = useCallback(async (newEnabled: boolean) => {
    setUpdating(true);
    try {
      await apiPost('/api/config/whitelist', {
        entries,
        enabled: newEnabled,
      });
      setEnabled(newEnabled);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle whitelist';
      push({ kind: 'error', title: 'Could not toggle whitelist', message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setUpdating(false);
    }
  }, [entries, push]);

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

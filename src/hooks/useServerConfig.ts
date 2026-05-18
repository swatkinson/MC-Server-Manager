import { useState, useCallback, useEffect } from 'react';
import { useApi, apiPost } from './useApi';
import { useServerSocket } from './useServerSocket';
import { useToasts } from '../context/ToastContext';

export interface ServerProperties {
  [key: string]: string | number | boolean;
}

interface UseServerConfigReturn {
  properties: ServerProperties | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveProperties: (properties: ServerProperties, backup?: boolean) => Promise<void>;
  refetch: () => void;
}

export function useServerConfig(): UseServerConfigReturn {
  const { data, loading, error, refetch } = useApi<ServerProperties>(
    '/api/config/server-properties',
    { manual: false }
  );
  const { on } = useServerSocket();
  const { push } = useToasts();
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<ServerProperties | null>(null);

  useEffect(() => {
    setProperties(data);
  }, [data]);

  useEffect(() => {
    const unsubscribe = on?.('config:updated', (updatedConfig: ServerProperties) => {
      setProperties(updatedConfig);
    });
    return unsubscribe;
  }, [on]);

  const saveProperties = useCallback(
    async (newProperties: ServerProperties, backup = false) => {
      setSaving(true);
      try {
        await apiPost('/api/config/server-properties', {
          properties: newProperties,
          backup,
        });
        setProperties(newProperties);
        push({
          kind: 'success',
          title: 'server.properties saved',
          message: 'Changes take effect on next server restart.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save properties';
        push({ kind: 'error', title: 'Could not save server.properties', message });
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [push]
  );

  return {
    properties,
    loading,
    error: error || null,
    saving,
    saveProperties,
    refetch,
  };
}

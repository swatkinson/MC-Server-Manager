import { useState, useCallback, useEffect } from 'react';
import { useApi, apiPost } from './useApi';
import { useServerSocket } from './useServerSocket';

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
      try {
        setSaving(true);
        await apiPost('/api/config/server-properties', {
          properties: newProperties,
          backup,
        });
        setProperties(newProperties);
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to save properties');
      } finally {
        setSaving(false);
      }
    },
    []
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

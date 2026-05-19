import { useState, useCallback } from 'react';
import { useApi, apiPost } from './useApi';
import { StartupScriptConfig } from '../types/api';

export function useStartupScript() {
  const { data, loading, error, refetch } = useApi<StartupScriptConfig>('/api/config/startup-script');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (cfg: Omit<StartupScriptConfig, 'rawCommand'>): Promise<boolean> => {
      setSaving(true);
      setSaveError(null);
      try {
        await apiPost('/api/config/startup-script', cfg);
        await refetch();
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save startup script');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [refetch],
  );

  return { config: data ?? null, loading, error, saving, saveError, save };
}

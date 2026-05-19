import { useState, useEffect, useCallback } from 'react';
import { RestartSchedule, RestartScheduleResult } from '../types/api';
import { useApi } from './useApi';
import { apiPost } from './useApi';
import { useServerSocket } from './useServerSocket';
import { useToasts } from '../context/ToastContext';

interface UseRestartSchedulerReturn {
  schedule: RestartSchedule | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  updateSchedule: (patch: Partial<RestartSchedule>) => Promise<void>;
  triggerRestart: () => Promise<void>;
}

export function useRestartScheduler(): UseRestartSchedulerReturn {
  const { data, loading, error } = useApi<{ schedule: RestartSchedule }>('/api/scheduler/restart');
  const [schedule, setSchedule] = useState<RestartSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const { on } = useServerSocket();
  const { push } = useToasts();

  useEffect(() => {
    if (data?.schedule) setSchedule(data.schedule);
  }, [data]);

  useEffect(() => {
    return on<RestartSchedule>('scheduler:updated', (updated) => {
      setSchedule(updated);
    });
  }, [on]);

  const updateSchedule = useCallback(
    async (patch: Partial<RestartSchedule>) => {
      setSaving(true);
      try {
        const result = await apiPost<RestartScheduleResult>('/api/scheduler/restart', patch);
        if (result.schedule) setSchedule(result.schedule);
        if (!result.success) {
          push({ kind: 'error', title: 'Failed to update schedule', message: result.message });
        }
      } catch (err) {
        push({
          kind: 'error',
          title: 'Failed to update schedule',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setSaving(false);
      }
    },
    [push],
  );

  const triggerRestart = useCallback(async () => {
    try {
      await apiPost('/api/scheduler/restart/now', {});
      push({ kind: 'info', title: 'Server restart initiated' });
    } catch (err) {
      push({
        kind: 'error',
        title: 'Failed to restart server',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [push]);

  return { schedule, loading, error, saving, updateSchedule, triggerRestart };
}

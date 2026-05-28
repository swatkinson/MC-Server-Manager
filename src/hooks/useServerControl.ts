import { useState, useCallback } from 'react';
import { ServerStatus } from '../types/api';
import { apiPost } from './useApi';
import { useToasts } from '../context/ToastContext';

type Action = 'start' | 'stop' | 'restart';

const ACTION_LABEL: Record<Action, string> = {
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
};

const EXPECTED_AFTER: Record<Action, 'online' | 'offline'> = {
  start: 'online',
  stop: 'offline',
  restart: 'online',
};

const VERIFY_TIMEOUT_MS: Record<Action, number> = {
  start: 30_000,
  stop: 20_000,
  restart: 45_000,
};

interface ActionResult {
  success: boolean;
  message?: string;
}

async function pollServerStatus(): Promise<ServerStatus> {
  const response = await fetch('/api/server/status');
  if (!response.ok) throw new Error(`status fetch failed: ${response.statusText}`);
  return response.json();
}

async function waitForStatus(
  expected: 'online' | 'offline',
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const current = await pollServerStatus();
      if (current.status === expected) return true;
    } catch {
      // ignore transient failures while we keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

interface UseServerControlOptions {
  onStatusChange?: () => void;
}

interface UseServerControlReturn {
  buttonLoading: Action | null;
  handleStart: () => void;
  handleStop: () => void;
  handleRestart: () => void;
}

export function useServerControl({ onStatusChange }: UseServerControlOptions): UseServerControlReturn {
  const [buttonLoading, setButtonLoading] = useState<Action | null>(null);
  const { push } = useToasts();

  const handleServerAction = useCallback(
    async (action: Action) => {
      const label = ACTION_LABEL[action];
      setButtonLoading(action);

      let result: ActionResult;
      try {
        result = await apiPost<ActionResult>(`/api/server/${action}`, {});
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Request failed';
        push({
          kind: 'error',
          title: `${label} request failed`,
          message: errorMessage,
        });
        setButtonLoading(null);
        return;
      }

      if (!result.success) {
        push({
          kind: 'error',
          title: `${label} failed`,
          message: result.message ?? 'The server rejected the request.',
        });
        onStatusChange?.();
        setButtonLoading(null);
        return;
      }

      push({
        kind: 'info',
        title: `${label} command sent`,
        message: 'Waiting for the server to respond…',
        durationMs: VERIFY_TIMEOUT_MS[action] + 5000,
      });

      onStatusChange?.();

      const arrived = await waitForStatus(EXPECTED_AFTER[action], VERIFY_TIMEOUT_MS[action]);
      onStatusChange?.();

      if (arrived) {
        push({
          kind: 'success',
          title: `${label} succeeded`,
          message: `Server is ${EXPECTED_AFTER[action]}.`,
        });
      } else {
        push({
          kind: 'error',
          title: `${label} did not complete`,
          message: `Server was not ${EXPECTED_AFTER[action]} after ${
            VERIFY_TIMEOUT_MS[action] / 1000
          }s. Check the console for clues.`,
          durationMs: 0,
        });
      }

      setButtonLoading(null);
    },
    [push, onStatusChange],
  );

  const handleStart = useCallback(() => { void handleServerAction('start'); }, [handleServerAction]);
  const handleStop = useCallback(() => { void handleServerAction('stop'); }, [handleServerAction]);
  const handleRestart = useCallback(() => { void handleServerAction('restart'); }, [handleServerAction]);

  return { buttonLoading, handleStart, handleStop, handleRestart };
}

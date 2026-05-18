import React, { useState, useCallback } from 'react';
import { ServerStatus } from '../types/api';
import { apiPost } from '../hooks/useApi';
import { useToasts } from '../context/ToastContext';

interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
  compact?: boolean;
}

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

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  status,
  loading = false,
  onStatusChange,
  compact = false,
}) => {
  const [buttonLoading, setButtonLoading] = useState<Action | null>(null);
  const { push } = useToasts();

  const isTransitioning = status?.status === 'starting' || status?.status === 'stopping';
  const isOnline = status?.status === 'online';
  const isOffline = status?.status === 'offline';

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

  const handleStart = () => handleServerAction('start');
  const handleStop = () => handleServerAction('stop');
  const handleRestart = () => handleServerAction('restart');

  const rootClassName = compact ? 'control-buttons control-buttons--compact' : 'control-buttons';

  if (loading) {
    return (
      <div className={rootClassName}>
        <div className="control-buttons__placeholder">Loading...</div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="control-buttons__group">
        {isOffline && (
          <button
            className="btn btn--green control-buttons__button"
            onClick={handleStart}
            disabled={buttonLoading !== null || isTransitioning}
            title={buttonLoading === 'start' ? 'Starting...' : 'Start the server'}
          >
            {buttonLoading === 'start' ? (
              <>
                <span className="control-buttons__spinner" />
                Starting...
              </>
            ) : (
              'Start Server'
            )}
          </button>
        )}

        {isOnline && (
          <button
            className="btn btn--red control-buttons__button"
            onClick={handleStop}
            disabled={buttonLoading !== null || isTransitioning}
            title={buttonLoading === 'stop' ? 'Stopping...' : 'Stop the server'}
          >
            {buttonLoading === 'stop' ? (
              <>
                <span className="control-buttons__spinner" />
                Stopping...
              </>
            ) : (
              'Stop Server'
            )}
          </button>
        )}

        <button
          className="btn btn--yellow control-buttons__button"
          onClick={handleRestart}
          disabled={buttonLoading !== null || isTransitioning || isOffline}
          title={
            isOffline
              ? 'Server is offline'
              : buttonLoading === 'restart'
                ? 'Restarting...'
                : 'Restart the server'
          }
        >
          {buttonLoading === 'restart' ? (
            <>
              <span className="control-buttons__spinner" />
              Restarting...
            </>
          ) : (
            'Restart Server'
          )}
        </button>
      </div>

      {isTransitioning && !buttonLoading && (
        <div className="control-buttons__status">
          <span className="control-buttons__spinner-small" />
          Server is {status?.status}...
        </div>
      )}
    </div>
  );
};

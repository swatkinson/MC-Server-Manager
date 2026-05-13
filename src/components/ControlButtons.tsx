import React, { useState, useCallback } from 'react';
import { ServerStatus } from '../types/api';
import { apiPost } from '../hooks/useApi';

interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  status,
  loading = false,
  onStatusChange,
}) => {
  const [buttonLoading, setButtonLoading] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTransitioning = status?.status === 'starting' || status?.status === 'stopping';
  const isOnline = status?.status === 'online';
  const isOffline = status?.status === 'offline';

  const handleServerAction = useCallback(
    async (action: 'start' | 'stop' | 'restart') => {
      try {
        setButtonLoading(action);
        setError(null);

        await apiPost(`/api/server/${action}`, {});

        // Trigger a status update after action
        onStatusChange?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to perform action';
        setError(errorMessage);
        console.error(`Failed to ${action} server:`, err);
      } finally {
        setButtonLoading(null);
      }
    },
    [onStatusChange]
  );

  const handleStart = () => handleServerAction('start');
  const handleStop = () => handleServerAction('stop');
  const handleRestart = () => handleServerAction('restart');

  if (loading) {
    return (
      <div className="control-buttons">
        <div className="control-buttons__placeholder">Loading...</div>
      </div>
    );
  }

  return (
    <div className="control-buttons">
      {error && <div className="control-buttons__error">{error}</div>}

      <div className="control-buttons__group">
        {/* Start button - visible when offline */}
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

        {/* Stop button - visible when online */}
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

        {/* Restart button - always visible */}
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

      {/* Status message during transitions */}
      {isTransitioning && !buttonLoading && (
        <div className="control-buttons__status">
          <span className="control-buttons__spinner-small" />
          Server is {status.status}...
        </div>
      )}
    </div>
  );
};

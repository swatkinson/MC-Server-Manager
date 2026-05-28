import React from 'react';
import { ServerStatus } from '../types/api';
import { useServerControl } from '../hooks/useServerControl';

interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
  compact?: boolean;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  status,
  loading = false,
  onStatusChange,
  compact = false,
}) => {
  const { buttonLoading, handleStart, handleStop, handleRestart } = useServerControl({ onStatusChange });

  const isTransitioning = status?.status === 'starting' || status?.status === 'stopping';
  const isOnline = status?.status === 'online';
  const isOffline = status?.status === 'offline';

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

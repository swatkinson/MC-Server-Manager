import { ServerStatus } from '../types/api';
import { useServerControl } from '../hooks/useServerControl';
import { Icon } from './icons/Icon';

interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
}

export function ControlButtons({ status, loading = false, onStatusChange }: ControlButtonsProps) {
  const { buttonLoading, handleStart, handleStop, handleRestart } = useServerControl({ onStatusChange });

  const isTransitioning = status?.status === 'starting' || status?.status === 'stopping';
  const isOnline = status?.status === 'online';
  const isOffline = status?.status === 'offline';
  const busy = loading || buttonLoading !== null || isTransitioning;

  const confirmThen = (message: string, action: () => void) => () => {
    if (window.confirm(message)) action();
  };

  return (
    <div className="control-buttons">
      {isOffline && (
        <button className="btn btn--green" onClick={handleStart} disabled={busy}>
          {buttonLoading === 'start' ? <span className="spinner" /> : <Icon name="play" size={16} />}
          {buttonLoading === 'start' ? 'Starting…' : 'Start'}
        </button>
      )}
      {!isOffline && (
        <button className="btn btn--ghost" onClick={confirmThen('Restart the server? Players will be disconnected.', handleRestart)} disabled={busy || !isOnline}>
          {buttonLoading === 'restart' ? <span className="spinner" /> : <Icon name="restart" size={16} />}
          {buttonLoading === 'restart' ? 'Restarting…' : 'Restart'}
        </button>
      )}
      {!isOffline && (
        <button className="btn btn--danger" onClick={confirmThen('Stop the server? Players will be disconnected.', handleStop)} disabled={busy || !isOnline}>
          {buttonLoading === 'stop' ? <span className="spinner" /> : <Icon name="stop" size={16} />}
          {buttonLoading === 'stop' ? 'Stopping…' : 'Stop'}
        </button>
      )}
    </div>
  );
}

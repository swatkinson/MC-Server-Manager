import { ConsoleInterface } from './ConsoleInterface';
import { ConsoleInput } from './ConsoleInput';
import { useConsoleLogs } from '../hooks/useConsoleLogs';
import { useConsoleCommand } from '../hooks/useConsoleCommand';

interface ConsolePanelProps {
  readOnly?: boolean;
}

export function ConsolePanel({ readOnly = false }: ConsolePanelProps) {
  const {
    logs,
    loading: logsLoading,
    error: logsError,
    connected: socketConnected,
  } = useConsoleLogs(300);

  const {
    executeCommand,
    getPreviousCommand,
    getNextCommand,
    resetHistory,
    loading: commandLoading,
    error: commandError,
    historyLength,
  } = useConsoleCommand();

  return (
    <div className="console-panel">
      <div className="console-panel__header">
        <h2 className="card__title">Console</h2>
        <span className={`live-pill ${socketConnected ? 'live-pill--on' : ''}`}>
          <span className="live-pill__dot" />
          {socketConnected ? 'Live' : 'Polling'}
        </span>
      </div>

      <div className="console-panel__content">
        <ConsoleInterface
          logs={logs}
          loading={logsLoading}
          error={logsError}
        />

        {!readOnly && (
          <ConsoleInput
            onSubmit={executeCommand}
            onPreviousCommand={getPreviousCommand}
            onNextCommand={getNextCommand}
            onResetHistory={resetHistory}
            loading={commandLoading}
            historyLength={historyLength}
            error={commandError}
          />
        )}
      </div>
    </div>
  );
}

import { ConsoleInterface } from './ConsoleInterface';
import { ConsoleInput } from './ConsoleInput';
import { useConsoleLogs } from '../hooks/useConsoleLogs';
import { useConsoleCommand } from '../hooks/useConsoleCommand';

export function ConsolePanel() {
  const {
    logs,
    loading: logsLoading,
    error: logsError,
    connected: socketConnected,
  } = useConsoleLogs(100);

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
        <h2>Server Console</h2>
        <div className="console-panel__status">
          <span
            className="console-panel__status-dot"
            style={{
              backgroundColor: socketConnected ? '#22c55e' : '#ef4444',
            }}
          />
          <span className="console-panel__status-text">
            {socketConnected ? 'Live' : 'Polling'}
          </span>
        </div>
      </div>

      <div className="console-panel__content">
        <ConsoleInterface
          logs={logs}
          loading={logsLoading}
          error={logsError}
        />

        <ConsoleInput
          onSubmit={executeCommand}
          onPreviousCommand={getPreviousCommand}
          onNextCommand={getNextCommand}
          onResetHistory={resetHistory}
          loading={commandLoading}
          historyLength={historyLength}
          error={commandError}
        />
      </div>
    </div>
  );
}

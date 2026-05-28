import { useEffect, useRef } from 'react';
import { LogLine } from '../types/api';

interface ConsoleInterfaceProps {
  logs: LogLine[];
  loading: boolean;
  error?: string | null;
}

const LOG_LEVEL_CLASSES: Record<LogLine['level'], string> = {
  ERROR: 'log-error',
  WARN: 'log-warn',
  INFO: 'log-info',
  DEBUG: 'log-muted',
};

export function ConsoleInterface({ logs, loading, error }: ConsoleInterfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const renderLogLine = (log: LogLine, index: number) => {
    const levelClass = LOG_LEVEL_CLASSES[log.level];

    return (
      <div
        key={`${log.timestamp}-${index}`}
        className={`console-interface__line ${levelClass}`}
      >
        <span className="console-interface__message">
          {log.message}
        </span>
      </div>
    );
  };

  return (
    <div className="console-interface">
      <div className="console-interface__container" ref={containerRef}>
        {loading && (
          <div className="console-interface__placeholder">
            <p>Loading console logs...</p>
          </div>
        )}

        {error && (
          <div className="console-interface__error">
            <p>Error: {error}</p>
          </div>
        )}

        {!loading && logs.length === 0 && !error && (
          <div className="console-interface__placeholder">
            <p>No logs available yet</p>
          </div>
        )}

        {logs.map((log, index) => renderLogLine(log, index))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

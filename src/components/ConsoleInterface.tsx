import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogLine } from '../types/api';

interface ConsoleInterfaceProps {
  logs: LogLine[];
  loading: boolean;
  error?: string | null;
}

interface ConsoleTooltip {
  text: string;
  x: number;
  y: number;
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
  const [activeTooltip, setActiveTooltip] = useState<ConsoleTooltip | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const renderLogLine = (log: LogLine, index: number) => {
    const levelClass = LOG_LEVEL_CLASSES[log.level];
    const tooltipText = [
      log.timestamp && `[${log.timestamp}]`,
      log.source && `[${log.source}]`,
    ].filter(Boolean).join(' ');

    return (
      <div
        key={`${log.timestamp}-${index}`}
        className={`console-interface__line ${levelClass}`}
        onMouseEnter={tooltipText ? (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActiveTooltip({ text: tooltipText, x: rect.left, y: rect.top });
        } : undefined}
        onMouseLeave={tooltipText ? () => setActiveTooltip(null) : undefined}
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

      {activeTooltip && createPortal(
        <div
          className="console-log-tooltip"
          style={{ top: activeTooltip.y, left: activeTooltip.x }}
        >
          {activeTooltip.text}
        </div>,
        document.body
      )}
    </div>
  );
}

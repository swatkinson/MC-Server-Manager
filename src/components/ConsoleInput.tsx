import { useState, useRef, useEffect } from 'react';

interface ConsoleInputProps {
  onSubmit: (command: string) => void;
  onPreviousCommand: (index: number) => string;
  onNextCommand: (index: number) => string;
  onResetHistory: () => void;
  loading: boolean;
  historyLength: number;
  error?: string | null;
  lastOutput?: string;
}

export function ConsoleInput({
  onSubmit,
  onPreviousCommand,
  onNextCommand,
  onResetHistory,
  loading,
  historyLength,
  error,
  lastOutput,
}: ConsoleInputProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showOutput, setShowOutput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset history when input changes
  useEffect(() => {
    if (input.length > 0 && historyIndex !== -1) {
      // User is typing, so they've exited history mode
      if (input !== onPreviousCommand(historyIndex) && input !== onNextCommand(historyIndex)) {
        // Only reset if they've actually typed something different
      }
    }
  }, [input, historyIndex, onPreviousCommand, onNextCommand]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input);
      setInput('');
      setHistoryIndex(-1);
      onResetHistory();
      setShowOutput(true);
      // Auto-hide output after 10 seconds
      setTimeout(() => setShowOutput(false), 10000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = historyIndex + 1;
      if (newIndex < historyLength) {
        setHistoryIndex(newIndex);
        const previousCmd = onPreviousCommand(newIndex);
        setInput(previousCmd);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        const nextCmd = onNextCommand(historyIndex);
        setHistoryIndex(newIndex);
        setInput(nextCmd);
      }
    }
  };

  return (
    <div className="console-input">
      <form className="console-input__form" onSubmit={handleSubmit}>
        <div className="console-input__input-wrapper">
          <span className="console-input__prompt">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            className="console-input__field"
            placeholder="Enter command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="console-input__submit"
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <>
              <span className="console-input__spinner" />
              Executing...
            </>
          ) : (
            'Submit'
          )}
        </button>
      </form>

      {error && (
        <div className="console-input__error-message">
          <span>Error: {error}</span>
        </div>
      )}

      {showOutput && lastOutput && (
        <div className="console-input__output">
          <div className="console-input__output-label">Output:</div>
          <div className="console-input__output-text">
            {lastOutput}
          </div>
        </div>
      )}

      <div className="console-input__hints">
        <span>Use ↑↓ for command history</span>
      </div>
    </div>
  );
}

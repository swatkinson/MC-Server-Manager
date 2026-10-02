import { useState, useRef } from 'react';

interface ConsoleInputProps {
  onSubmit: (command: string) => void;
  onPreviousCommand: (index: number) => string;
  onNextCommand: (index: number) => string;
  onResetHistory: () => void;
  loading: boolean;
  historyLength: number;
  error?: string | null;
}

export function ConsoleInput({
  onSubmit,
  onPreviousCommand,
  onNextCommand,
  onResetHistory,
  loading,
  historyLength,
  error,
}: ConsoleInputProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input);
      setInput('');
      setHistoryIndex(-1);
      onResetHistory();
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
          <span className="console-input__prompt">{'›'}</span>
          <input
            ref={inputRef}
            type="text"
            className="console-input__field"
            placeholder="Type a command (↑↓ history)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
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
              Sending…
            </>
          ) : (
            'Send'
          )}
        </button>
      </form>

      {error && (
        <div className="console-input__error-message">
          <span>Error: {error}</span>
        </div>
      )}

    </div>
  );
}

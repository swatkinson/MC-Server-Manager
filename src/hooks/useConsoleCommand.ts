import { useState, useCallback } from 'react';
import { ConsoleCommandResponse } from '../types/api';
import { apiPost } from './useApi';
import { useToasts } from '../context/ToastContext';

export function useConsoleCommand() {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { push } = useToasts();

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) {
      setError('Command cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiPost<ConsoleCommandResponse>('/api/console/command', {
        command,
      });

      if (response.success) {
        setCommandHistory((prev) => [...prev, command]);
        setHistoryIndex(-1);
      } else {
        setError('Command execution failed');
        push({
          kind: 'error',
          title: 'Console command failed',
          message: 'The server reported a failure executing the command.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute command';
      setError(errorMessage);
      push({
        kind: 'error',
        title: 'Console command failed',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [push]);

  const getPreviousCommand = useCallback(
    (currentIndex: number) => {
      const newIndex = currentIndex + 1;
      if (newIndex < commandHistory.length) {
        setHistoryIndex(newIndex);
        return commandHistory[commandHistory.length - 1 - newIndex];
      }
      return '';
    },
    [commandHistory],
  );

  const getNextCommand = useCallback(
    (currentIndex: number) => {
      const newIndex = currentIndex - 1;
      if (newIndex >= 0) {
        setHistoryIndex(newIndex);
        return commandHistory[commandHistory.length - 1 - newIndex];
      }
      if (newIndex === -1) {
        setHistoryIndex(-1);
      }
      return '';
    },
    [commandHistory],
  );

  const resetHistory = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  return {
    executeCommand,
    getPreviousCommand,
    getNextCommand,
    resetHistory,
    loading,
    error,
    historyLength: commandHistory.length,
  };
}

import { useState, useCallback } from 'react';
import { ConsoleCommandResponse } from '../types/api';
import { apiPost } from './useApi';
import { useServerSocket } from './useServerSocket';

export function useConsoleCommand() {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<string>('');

  const { on } = useServerSocket();

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) {
      setError('Command cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setLastOutput('');

      const response = await apiPost<ConsoleCommandResponse>(
        '/api/console/command',
        { command }
      );

      if (response.success) {
        setLastOutput(response.output);
        // Add to history
        setCommandHistory((prev) => [...prev, command]);
        setHistoryIndex(-1);
      } else {
        setError('Command execution failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute command';
      setError(errorMessage);
      setLastOutput('');
    } finally {
      setLoading(false);
    }
  }, []);

  const getPreviousCommand = useCallback((currentIndex: number) => {
    const newIndex = currentIndex + 1;
    if (newIndex < commandHistory.length) {
      setHistoryIndex(newIndex);
      return commandHistory[commandHistory.length - 1 - newIndex];
    }
    return '';
  }, [commandHistory]);

  const getNextCommand = useCallback((currentIndex: number) => {
    const newIndex = currentIndex - 1;
    if (newIndex >= 0) {
      setHistoryIndex(newIndex);
      return commandHistory[commandHistory.length - 1 - newIndex];
    } else if (newIndex === -1) {
      setHistoryIndex(-1);
      return '';
    }
    return '';
  }, [commandHistory]);

  const resetHistory = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  // Listen for command execution events from WebSocket
  // (useful if commands are executed from other clients)
  on('console:command:executed', (data: { command: string; output: string }) => {
    setLastOutput(data.output);
  });

  return {
    executeCommand,
    getPreviousCommand,
    getNextCommand,
    resetHistory,
    loading,
    error,
    lastOutput,
    historyLength: commandHistory.length,
  };
}

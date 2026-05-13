import { useState, useEffect, useCallback } from 'react';
import { Player } from '../types/api';
import { useApi } from './useApi';
import { useServerSocket } from './useServerSocket';

export function usePlayerList() {
  const { data, loading, error, refetch } = useApi<{ players: Player[] }>('/api/players');
  const { on } = useServerSocket();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (data?.players) {
      setPlayers(data.players);
    }
  }, [data]);

  useEffect(() => {
    const unsubscribe = on('players:updated', (response: { players: Player[] }) => {
      setPlayers(response.players);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [on]);

  const sortPlayers = useCallback(
    (players: Player[], sortBy: 'name' | 'joinTime'): Player[] => {
      const sorted = [...players];
      if (sortBy === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'joinTime') {
        sorted.sort((a, b) => b.joinTime - a.joinTime);
      }
      return sorted;
    },
    []
  );

  return {
    players,
    loading,
    error,
    refetch,
    sortPlayers,
  };
}

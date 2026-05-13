import { useState, useMemo } from 'react';
import { usePlayerList } from '../hooks/usePlayerList';
import { Player } from '../types/api';

type SortBy = 'name' | 'joinTime';

export function PlayerList() {
  const { players, loading, error, sortPlayers } = usePlayerList();
  const [sortBy, setSortBy] = useState<SortBy>('joinTime');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = [...players];

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter((player) =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered = sortPlayers(filtered, sortBy);

    return filtered;
  }, [players, sortBy, searchTerm, sortPlayers]);

  const formatJoinTime = (joinTime: number): string => {
    const now = Date.now();
    const elapsed = now - joinTime;

    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(elapsed / 3600000);
    const days = Math.floor(elapsed / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (error) {
    return (
      <div className="player-list">
        <div className="player-list__error">
          <p>Failed to load player list: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="player-list">
      <div className="player-list__header">
        <h3 className="player-list__title">Online Players</h3>
        <span className="player-list__count">
          {loading ? '...' : filteredAndSortedPlayers.length}
        </span>
      </div>

      <div className="player-list__controls">
        <input
          type="text"
          className="player-list__search"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="player-list__sort-group">
          <label className="player-list__label">Sort by:</label>
          <select
            className="player-list__select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="joinTime">Join Time (Newest)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

      </div>

      {loading && filteredAndSortedPlayers.length === 0 ? (
        <div className="player-list__placeholder">
          <p>Loading players...</p>
        </div>
      ) : filteredAndSortedPlayers.length === 0 ? (
        <div className="player-list__placeholder">
          <p>No players online</p>
        </div>
      ) : (
        <div className="player-list__table-wrapper">
          <table className="player-list__table">
            <thead className="player-list__thead">
              <tr>
                <th className="player-list__th player-list__th--name">Player Name</th>
                <th className="player-list__th player-list__th--uuid">UUID</th>
                <th className="player-list__th player-list__th--joinTime">Join Time</th>
                <th className="player-list__th player-list__th--status">Status</th>
              </tr>
            </thead>
            <tbody className="player-list__tbody">
              {filteredAndSortedPlayers.map((player) => (
                <tr key={player.uuid} className="player-list__tr">
                  <td className="player-list__td player-list__td--name">
                    <span className="player-list__player-name">{player.name}</span>
                    {player.isOp && <span className="player-list__op-badge">OP</span>}
                  </td>
                  <td className="player-list__td player-list__td--uuid">
                    <code className="player-list__uuid">{player.uuid}</code>
                  </td>
                  <td className="player-list__td player-list__td--joinTime">
                    {formatJoinTime(player.joinTime)}
                  </td>
                  <td className="player-list__td player-list__td--status">
                    <span className="player-list__status-badge player-list__status-badge--online">
                      Online
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

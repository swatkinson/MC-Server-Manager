import { useState, useMemo } from 'react';
import { usePlayerList } from '../hooks/usePlayerList';

type SortBy = 'name' | 'joinTime';

function formatJoinTime(joinTime: number): string {
  const elapsed = Date.now() - joinTime;
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function avatarUrl(name: string, size = 48): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
}

export function PlayerList() {
  const { players, loading, error, sortPlayers } = usePlayerList();
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('joinTime');
  const [searchTerm, setSearchTerm] = useState('');

  const stripPlayers = useMemo(
    () => sortPlayers([...players], 'joinTime'),
    [players, sortPlayers]
  );

  const detailPlayers = useMemo(() => {
    let filtered = [...players];
    if (searchTerm.trim()) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return sortPlayers(filtered, sortBy);
  }, [players, sortBy, searchTerm, sortPlayers]);

  const count = stripPlayers.length;

  return (
    <>
      <div className="player-strip" role="region" aria-label="Online players">
        <button
          type="button"
          className="player-strip__count"
          onClick={() => setExpanded(true)}
          title="Show full player list"
          aria-label={`${count} player${count === 1 ? '' : 's'} online — open details`}
        >
          <span className="player-strip__count-value">{loading ? '…' : count}</span>
          <span className="player-strip__count-label">online</span>
        </button>

        <div className="player-strip__list">
          {error ? (
            <div className="player-strip__error" title={error}>!</div>
          ) : stripPlayers.length === 0 ? (
            <div className="player-strip__empty" title="No players online" />
          ) : (
            stripPlayers.map((player) => (
              <button
                key={player.uuid}
                type="button"
                className="player-strip__player"
                onClick={() => setExpanded(true)}
                title={player.name + (player.isOp ? ' (OP)' : '')}
                aria-label={`Open details for ${player.name}`}
              >
                <img
                  src={avatarUrl(player.name)}
                  alt={player.name}
                  className="player-strip__avatar"
                  loading="lazy"
                />
                <span className="player-strip__tooltip">
                  {player.name}
                  {player.isOp && <span className="player-strip__tooltip-op">OP</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="player-modal__backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Online players"
          onClick={() => setExpanded(false)}
        >
          <div className="player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="player-modal__header">
              <h3 className="player-modal__title">
                Online Players <span className="player-modal__count">{count}</span>
              </h3>
              <button
                type="button"
                className="player-modal__close"
                onClick={() => setExpanded(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="player-modal__controls">
              <input
                type="text"
                className="player-list__search"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="player-list__select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort players"
              >
                <option value="joinTime">Join Time (Newest)</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {error ? (
              <div className="player-list__error">
                <p>Failed to load player list: {error}</p>
              </div>
            ) : detailPlayers.length === 0 ? (
              <div className="player-list__placeholder">
                <p>{loading ? 'Loading players...' : 'No players online'}</p>
              </div>
            ) : (
              <div className="player-modal__list">
                {detailPlayers.map((player) => (
                  <div key={player.uuid} className="player-modal__row">
                    <img
                      src={avatarUrl(player.name, 40)}
                      alt={player.name}
                      className="player-modal__avatar"
                      loading="lazy"
                    />
                    <div className="player-modal__info">
                      <div className="player-modal__name-row">
                        <span className="player-modal__name">{player.name}</span>
                        {player.isOp && <span className="player-list__op-badge">OP</span>}
                      </div>
                      <code className="player-list__uuid">{player.uuid}</code>
                    </div>
                    <div className="player-modal__meta">
                      <span className="player-list__status-badge player-list__status-badge--online">
                        Online
                      </span>
                      <span className="player-modal__joined">{formatJoinTime(player.joinTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

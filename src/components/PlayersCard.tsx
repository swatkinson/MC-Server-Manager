import type { Player } from '../types/api';

function avatarUrl(name: string, size = 40): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
}

function since(joinTime: number): string {
  const minutes = Math.floor((Date.now() - joinTime) / 60_000);
  if (minutes < 1) return 'just joined';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function PlayersCard({ players, loading, online }: { players: Player[]; loading: boolean; online: boolean }) {
  const sorted = [...players].sort((a, b) => a.joinTime - b.joinTime);
  return (
    <section className="card glass players-card">
      <header className="card__header">
        <h2 className="card__title">Players online</h2>
        <span className="count-badge">{players.length}</span>
      </header>
      {!online ? (
        <div className="empty-state">Server offline</div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">{loading ? 'Loading…' : 'Nobody online right now'}</div>
      ) : (
        <ul className="players-card__list">
          {sorted.map((p) => (
            <li key={p.uuid} className="players-card__row">
              <img className="players-card__avatar" src={avatarUrl(p.name)} alt="" loading="lazy" />
              <div className="players-card__info">
                <span className="players-card__name">
                  {p.name}
                  {p.isOp && <span className="tag tag--accent">OP</span>}
                </span>
                <span className="players-card__meta">online for {since(p.joinTime)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

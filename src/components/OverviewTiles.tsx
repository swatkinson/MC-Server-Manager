import type { ServerStatus, SystemMetrics } from '../types/api';
import { formatBytes } from '../utils/formatting';
import { Icon, IconName } from './icons/Icon';

interface TileProps {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
}

function Tile({ icon, label, value, hint, tone = 'neutral' }: TileProps) {
  return (
    <div className={`tile glass tile--${tone}`}>
      <div className="tile__icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="tile__body">
        <span className="tile__label">{label}</span>
        <span className="tile__value">{value}</span>
        {hint && <span className="tile__hint">{hint}</span>}
      </div>
    </div>
  );
}

const pctTone = (pct: number): TileProps['tone'] => (pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'ok');

export function OverviewTiles({
  status,
  metrics,
  playerCount,
}: {
  status: ServerStatus | null;
  metrics: SystemMetrics | null;
  playerCount: number;
}) {
  const online = status?.status === 'online';
  const tps = metrics?.tps;
  const jvm = metrics?.ram.jvm;
  const livePct = jvm?.heapMax && jvm.source === 'hsperfdata' ? (jvm.heapLive / jvm.heapMax) * 100 : null;

  return (
    <div className="tiles">
      <Tile
        icon="player"
        label="Players"
        value={online ? `${playerCount} / ${status?.players.max ?? '—'}` : '—'}
        hint={online ? (playerCount === 1 ? '1 player online' : `${playerCount} players online`) : 'Server offline'}
      />
      <Tile
        icon="pulse"
        label="Tick rate"
        value={online && tps?.tps != null ? `${tps.tps.toFixed(1)} TPS` : '—'}
        hint={tps?.mspt != null ? `${tps.mspt.toFixed(1)} ms per tick · ${Math.round(tps.headroomPercent ?? 0)}% headroom` : 'Waiting for a reading'}
        tone={!online || tps?.tps == null ? 'neutral' : tps.tps >= 19.5 ? 'ok' : tps.tps >= 18 ? 'warn' : 'bad'}
      />
      <Tile
        icon="memory"
        label="Minecraft memory"
        value={jvm && livePct !== null ? formatBytes(jvm.heapLive, 1) : '—'}
        hint={jvm && livePct !== null ? `live · ${livePct.toFixed(0)}% of ${formatBytes(jvm.heapMax ?? 0, 0)} heap` : 'Not running'}
        tone={!jvm ? 'neutral' : jvm.pressure === 'ok' ? 'ok' : jvm.pressure === 'elevated' ? 'warn' : 'bad'}
      />
      <Tile
        icon="cpu"
        label="CPU"
        value={metrics ? `${metrics.cpu.percentage.toFixed(0)}%` : '—'}
        hint={metrics ? `${metrics.cpu.cores.length} cores` : undefined}
        tone={metrics ? pctTone(metrics.cpu.percentage) : 'neutral'}
      />
      <Tile
        icon="disk"
        label="Storage"
        value={metrics ? `${formatBytes(metrics.storage.free, 0)} free` : '—'}
        hint={metrics ? `${metrics.storage.percentage.toFixed(0)}% of ${formatBytes(metrics.storage.total, 0)} used` : undefined}
        tone={metrics ? pctTone(metrics.storage.percentage) : 'neutral'}
      />
    </div>
  );
}

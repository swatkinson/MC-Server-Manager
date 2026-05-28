import React from 'react';
import { ServerStatus, TpsMetrics } from '../types/api';

const STATUS_CLASSES: Record<ServerStatus['status'], string> = {
  online: 'status-online',
  offline: 'status-offline',
  starting: 'status-starting',
  stopping: 'status-stopping',
};

interface ServerHeaderProps {
  status: ServerStatus | null;
  tps?: TpsMetrics | null;
  loading?: boolean;
  actions?: React.ReactNode;
  publicIp?: string | null;
}

function tpsColor(tps: number | null): string {
  if (tps === null) return 'var(--text)';
  if (tps >= 19.5) return 'var(--green)';
  if (tps >= 18) return 'var(--yellow)';
  return 'var(--red)';
}

export const ServerHeader: React.FC<ServerHeaderProps> = ({ status, tps, loading = false, actions, publicIp }) => {
  if (loading || !status) {
    return (
      <div className="server-header">
        <div className="server-header__main">
          <div className="server-header__title-group">
            <h1 className="server-header__name">Loading...</h1>
          </div>
        </div>
        <div className="server-header__info-grid">
          <div className="server-header__status-indicator server-header__status-indicator--end">
            <span className="server-header__status-dot status-dot--muted" />
            <span className="server-header__status-text">—</span>
          </div>
        </div>
      </div>
    );
  }

  const statusClass = STATUS_CLASSES[status.status];
  const statusLabel = status.status.charAt(0).toUpperCase() + status.status.slice(1);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="server-header">
      <div className="server-header__main">
        <div className="server-header__title-group">
          <div className="server-header__title-block">
            <h1 className="server-header__name">{status.motd || 'Minecraft Server'}</h1>
            <p className="server-header__description">{publicIp ?? status.ip}</p>
          </div>
          {actions && <div className="server-header__status-cluster">{actions}</div>}
        </div>
      </div>

      <div className="server-header__info-grid">
        <div className="server-header__info-item">
          <span className="server-header__info-label">Version</span>
          <span className="server-header__info-value">{status.version}</span>
        </div>
        <div className="server-header__info-item">
          <span className="server-header__info-label">Uptime</span>
          <span className="server-header__info-value">
            {status.status === 'online' ? formatUptime(status.uptime) : '—'}
          </span>
        </div>
        <div className="server-header__info-item">
          <span className="server-header__info-label">TPS</span>
          <span
            className="server-header__info-value"
            style={{ color: tpsColor(tps?.tps ?? null) }}
          >
            {status.status === 'online' && tps?.tps !== null && tps?.tps !== undefined
              ? `${tps.tps.toFixed(1)}${
                  tps.headroomPercent !== null
                    ? ` (${Math.round(tps.headroomPercent)}% headroom)`
                    : ''
                }`
              : '—'}
          </span>
        </div>
        <div className="server-header__status-indicator server-header__status-indicator--end">
          <span className={`server-header__status-dot ${statusClass}`} />
          <span className={`server-header__status-text ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
};

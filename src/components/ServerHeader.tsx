import React from 'react';
import { ServerStatus } from '../types/api';

const STATUS_COLORS: Record<ServerStatus['status'], string> = {
  online: '#22c55e',
  offline: '#ef4444',
  starting: '#f59e0b',
  stopping: '#f59e0b',
};

interface ServerHeaderProps {
  status: ServerStatus | null;
  loading?: boolean;
}

export const ServerHeader: React.FC<ServerHeaderProps> = ({ status, loading = false }) => {
  if (loading || !status) {
    return (
      <div className="server-header">
        <div className="server-header__main">
          <div className="server-header__title-group">
            <h1 className="server-header__name">Loading...</h1>
            <div className="server-header__status-indicator">
              <span className="server-header__status-dot" style={{ backgroundColor: '#6b7280' }} />
              <span className="server-header__status-text">—</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[status.status];
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
          <h1 className="server-header__name">{status.motd || 'Minecraft Server'}</h1>
          <div className="server-header__status-indicator">
            <span
              className="server-header__status-dot"
              style={{ backgroundColor: statusColor }}
            />
            <span className="server-header__status-text">{statusLabel}</span>
          </div>
        </div>
        <p className="server-header__description">{status.ip}</p>
      </div>

      <div className="server-header__info-grid">
        <div className="server-header__info-item">
          <span className="server-header__info-label">Players</span>
          <span className="server-header__info-value">
            {status.players.current}/{status.players.max}
          </span>
        </div>
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
      </div>
    </div>
  );
};

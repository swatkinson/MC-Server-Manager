import { useState } from 'react'
import { ConsolePanel } from '../components/ConsolePanel'

type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping'

const STATUS_COLORS: Record<ServerStatus, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  starting: '#f59e0b',
  stopping: '#f59e0b',
}

export function Dashboard() {
  const [status, setStatus] = useState<ServerStatus>('offline')

  return (
    <div className="dashboard">
      <header className="header">
        <h1>MC Server Manager</h1>
        <p>Manage your Minecraft server from the browser</p>
      </header>

      <main className="main">
        <section className="card">
          <h2>Server Status</h2>
          <div className="status-indicator">
            <span
              className="status-dot"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            <span className="status-text">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Server Info</h2>
          <div className="info-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="info-item">
              <span className="info-label">Version</span>
              <span className="info-value">—</span>
            </div>
            <div className="info-item">
              <span className="info-label">Players</span>
              <span className="info-value">—</span>
            </div>
            <div className="info-item">
              <span className="info-label">Uptime</span>
              <span className="info-value">—</span>
            </div>
            <div className="info-item">
              <span className="info-label">RAM</span>
              <span className="info-value">—</span>
            </div>
          </div>
        </section>

        <section className="card card--full">
          <h2>Quick Actions</h2>
          <div className="button-grid">
            <button className="btn btn--green" onClick={() => setStatus('starting')}>
              Start Server
            </button>
            <button className="btn btn--red" onClick={() => setStatus('stopping')}>
              Stop Server
            </button>
            <button className="btn btn--yellow" onClick={() => setStatus('starting')}>
              Restart Server
            </button>
            <button className="btn btn--blue" onClick={() => alert('Logs coming in Phase 4')}>
              View Logs
            </button>
            <button className="btn btn--purple" onClick={() => alert('Player list coming in Phase 3')}>
              Player List
            </button>
            <button className="btn btn--gray" onClick={() => alert('Settings coming in Phase 5')}>
              Settings
            </button>
          </div>
        </section>

        <section className="card card--full" style={{ minHeight: '500px' }}>
          <ConsolePanel />
        </section>
      </main>
    </div>
  )
}

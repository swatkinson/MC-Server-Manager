import { ServerHeader } from '../components/ServerHeader'
import { ControlButtons } from '../components/ControlButtons'
import { ConsolePanel } from '../components/ConsolePanel'
import { PlayerList } from '../components/PlayerList'
import { MetricsGauges } from '../components/MetricsGauges'
import { ConfigPanel } from '../components/ConfigPanel'
import { useMetrics } from '../hooks/useMetrics'

export function Dashboard() {
  const { metrics, loading, error } = useMetrics()

  return (
    <div className="dashboard">
      <ServerHeader />

      <main className="main" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--spacing-lg)', padding: 'var(--spacing-lg)' }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <section className="card">
            <h2>Server Control</h2>
            <ControlButtons />
          </section>

          <section className="card">
            <h2>Configuration</h2>
            <ConfigPanel />
          </section>
        </aside>

        <article style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <section className="card card--full">
            <h2>System Metrics</h2>
            <MetricsGauges metrics={metrics} loading={loading} error={error} />
          </section>

          <section className="card card--full">
            <h2>Player List</h2>
            <PlayerList />
          </section>

          <section className="card card--full" style={{ minHeight: '500px' }}>
            <h2>Server Console</h2>
            <ConsolePanel />
          </section>
        </article>
      </main>
    </div>
  )
}

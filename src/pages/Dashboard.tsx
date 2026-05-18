import { ServerHeader } from '../components/ServerHeader'
import { ControlButtons } from '../components/ControlButtons'
import { ConsolePanel } from '../components/ConsolePanel'
import { PlayerList } from '../components/PlayerList'
import { MetricsGauges } from '../components/MetricsGauges'
import { ConfigPanel } from '../components/ConfigPanel'
import { useMetrics } from '../hooks/useMetrics'
import { useServerStatus } from '../hooks/useServerStatus'

export function Dashboard() {
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics()
  const { status, loading: statusLoading, refetch: refetchStatus } = useServerStatus()

  return (
    <div className="dashboard">
      <ServerHeader status={status} loading={statusLoading} />

      <main className="dashboard__main">
        <aside className="dashboard__aside">
          <section className="card">
            <h2>Server Control</h2>
            <ControlButtons
              status={status}
              loading={statusLoading}
              onStatusChange={refetchStatus}
            />
          </section>

          <section className="card">
            <h2>Configuration</h2>
            <ConfigPanel />
          </section>
        </aside>

        <article className="dashboard__content">
          <section className="card card--full">
            <h2>System Metrics</h2>
            <MetricsGauges metrics={metrics} loading={metricsLoading} error={metricsError} />
          </section>

          <section className="card card--full">
            <h2>Player List</h2>
            <PlayerList />
          </section>

          <section className="card card--full dashboard__console">
            <ConsolePanel />
          </section>
        </article>
      </main>
    </div>
  )
}

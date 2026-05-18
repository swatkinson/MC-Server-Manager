import { ServerHeader } from '../components/ServerHeader'
import { ControlButtons } from '../components/ControlButtons'
import { ConsolePanel } from '../components/ConsolePanel'
import { PlayerList } from '../components/PlayerList'
import { MetricsGauges } from '../components/MetricsGauges'
import { ConfigPanel } from '../components/ConfigPanel'
import { useMetrics } from '../hooks/useMetrics'
import { useServerStatus } from '../hooks/useServerStatus'
import { useStartupChecks } from '../hooks/usePreflight'
import { usePortForwardCheck } from '../hooks/usePortForwardCheck'

export function Dashboard() {
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics()
  const { status, loading: statusLoading, refetch: refetchStatus } = useServerStatus()
  useStartupChecks()
  usePortForwardCheck()

  return (
    <div className="dashboard">
      <ServerHeader
        status={status}
        tps={metrics?.tps ?? null}
        loading={statusLoading}
        actions={
          <ControlButtons
            status={status}
            loading={statusLoading}
            onStatusChange={refetchStatus}
            compact
          />
        }
      />

      <main className="dashboard__main">
        <aside className="dashboard__aside">
          <section className="card">
            <h2>System Metrics</h2>
            <MetricsGauges metrics={metrics} loading={metricsLoading} error={metricsError} />
          </section>

          <section className="card">
            <h2>Configuration</h2>
            <ConfigPanel serverStatus={status} />
          </section>
        </aside>

        <article className="dashboard__content">
          <section className="card dashboard__console">
            <ConsolePanel />
          </section>
        </article>

        <PlayerList />
      </main>
    </div>
  )
}

import { ServerHeader } from '../components/ServerHeader'
import { ControlButtons } from '../components/ControlButtons'
import { ConsolePanel } from '../components/ConsolePanel'
import { PlayerList } from '../components/PlayerList'
import { MetricsGauges } from '../components/MetricsGauges'
import { ConfigPanel } from '../components/ConfigPanel'
import { UserMenu } from '../components/UserMenu'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useMetrics } from '../hooks/useMetrics'
import { useServerStatus } from '../hooks/useServerStatus'
import { useStartupChecks } from '../hooks/usePreflight'
import { usePortForwardCheck } from '../hooks/usePortForwardCheck'
import { usePublicIp } from '../hooks/usePublicIp'
import { useAuth } from '../context/AuthContext'

export function Dashboard() {
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics()
  const { status, loading: statusLoading, refetch: refetchStatus } = useServerStatus()
  const publicIp = usePublicIp()
  const { user } = useAuth()
  useStartupChecks()
  usePortForwardCheck()

  return (
    <div className="dashboard">
      <ServerHeader
        status={status}
        tps={metrics?.tps ?? null}
        loading={statusLoading}
        publicIp={publicIp}
        actions={
          <>
            <ThemeSwitcher />
            {user?.role !== 'user' && (
              <ControlButtons
                status={status}
                loading={statusLoading}
                onStatusChange={refetchStatus}
                compact
              />
            )}
            <UserMenu />
          </>
        }
      />

      <main className="dashboard__main">
        <aside className="dashboard__aside">
          <section className="card">
            <h2>System Metrics</h2>
            <MetricsGauges metrics={metrics} loading={metricsLoading} error={metricsError} />
          </section>

          {user?.role !== 'user' && (
            <section className="card">
              <h2>Configuration</h2>
              <ConfigPanel serverStatus={status} />
            </section>
          )}
        </aside>

        <article className="dashboard__content">
          <section className="card dashboard__console">
            <ConsolePanel readOnly={user?.role === 'user'} />
          </section>
        </article>

        <PlayerList />
      </main>
    </div>
  )
}

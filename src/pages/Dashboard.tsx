import { ConsolePanel } from '../components/ConsolePanel'
import { OverviewTiles } from '../components/OverviewTiles'
import { JvmMemoryCard } from '../components/JvmMemoryCard'
import { SystemCard } from '../components/SystemCard'
import { PlayersCard } from '../components/PlayersCard'
import { usePlayerList } from '../hooks/usePlayerList'
import { useStartupChecks } from '../hooks/usePreflight'
import { usePortForwardCheck } from '../hooks/usePortForwardCheck'
import { useAuth } from '../context/AuthContext'
import { useServerData } from '../context/ServerDataContext'

export function Dashboard() {
  const { status, metrics } = useServerData()
  const { players, loading: playersLoading } = usePlayerList()
  const { user } = useAuth()
  useStartupChecks()
  usePortForwardCheck()

  const online = status?.status === 'online'

  return (
    <div className="overview">
      <OverviewTiles status={status} metrics={metrics} playerCount={online ? players.length : 0} />

      <div className="overview__grid">
        <div className="overview__main">
          <JvmMemoryCard metrics={metrics} />
          <section className="card glass overview__console">
            <ConsolePanel readOnly={user?.role === 'user'} />
          </section>
        </div>
        <div className="overview__side">
          <PlayersCard players={players} loading={playersLoading} online={online} />
          <SystemCard metrics={metrics} />
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react';
import { useHostBackups } from '../hooks/useHostBackups';
import { useToasts } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useServerData } from '../context/ServerDataContext';
import { WorldBackupDownloader } from '../components/WorldBackupDownloader';
import { BackupGatewaySettings } from '../components/BackupGatewaySettings';
import { Icon } from '../components/icons/Icon';
import { formatBytes, formatRelative } from '../utils/formatting';

export function BackupsPage() {
  const { status, loading, refetch, runBackup, starting, restore, restoring, saveConfig } = useHostBackups();
  const { status: server } = useServerData();
  const { user } = useAuth();
  const { push: toast } = useToasts();
  const [worldDownloadOpen, setWorldDownloadOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const serverOffline = server?.status === 'offline';
  const latest = status?.archives[0];
  const lastRun = status?.lastRun;
  const busy = Boolean(status?.running || lastRun?.state === 'running');

  async function handleRun() {
    try {
      await runBackup();
      toast({ kind: 'info', title: 'Backup started', message: 'The host is saving and archiving the world. This usually takes a minute.' });
    } catch (err) {
      toast({ kind: 'error', title: 'Could not start backup', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleRestore(filename: string) {
    const ok = window.confirm(
      `Restore ${filename}?\n\nThe current world folder is moved aside (kept as world.pre-restore-…) and replaced with this backup. Anything built since the backup will be gone from the live world.`,
    );
    if (!ok) return;
    try {
      const result = await restore(filename);
      toast({ kind: 'success', title: 'World restored', message: `Previous world kept as ${result.keptAs}. Start the server when ready.` });
    } catch (err) {
      toast({ kind: 'error', title: 'Restore failed', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h2 className="page__title">World backups</h2>
          <p className="page__subtitle">
            Made by the Proxmox host's nightly job. Each backup is the world folder only, saved safely
            (save-off → flush → save-on) to the host's backup SSD, separate from this VM.
          </p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost" onClick={() => setWorldDownloadOpen(true)}>
            <Icon name="download" size={16} /> Download live world
          </button>
          <button className="btn btn--primary" onClick={() => void handleRun()} disabled={!status?.reachable || busy || starting}>
            {busy || starting ? <span className="spinner" /> : <Icon name="archive" size={16} />}
            {busy ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
      </header>

      {status && !status.reachable && (
        <div className="banner banner--bad">
          <strong>Can't reach the backup host.</strong> {status.error}
        </div>
      )}
      {busy && (
        <div className="banner banner--info">
          <span className="spinner" /> A backup is running on the host — the world is briefly read-only to the save system while it's archived.
        </div>
      )}
      {lastRun?.state === 'failed' && !busy && (
        <div className="banner banner--bad">
          <strong>The last backup failed</strong> ({formatRelative(lastRun.startedAt * 1000)}). {lastRun.message}
        </div>
      )}

      <div className="tiles tiles--4">
        <Fact label="Latest backup" value={latest ? formatRelative(latest.createdAt) : '—'} hint={latest ? `${new Date(latest.createdAt).toLocaleString()} · ${formatBytes(latest.sizeBytes, 1)}` : 'None yet'} />
        <Fact label="Next scheduled" value={status?.schedule.nextRunAt ? formatRelative(status.schedule.nextRunAt) : '—'} hint={status?.schedule.nextRunAt ? new Date(status.schedule.nextRunAt).toLocaleString() : 'Timer not found'} />
        <Fact label="Retention" value={status?.keep ? `${status.keep} backups` : '—'} hint={status ? `${status.archives.length} stored now` : undefined} />
        <Fact label="Backup disk" value={status?.disk ? `${formatBytes(status.disk.free, 0)} free` : '—'} hint={status?.disk ? `of ${formatBytes(status.disk.total, 0)}` : undefined} />
      </div>

      <section className="card glass">
        <header className="card__header">
          <h2 className="card__title">Archives</h2>
          <button className="btn btn--ghost btn--sm" onClick={() => void refetch()}>Refresh</button>
        </header>
        {loading && !status ? (
          <div className="empty-state">Asking the backup host…</div>
        ) : !status?.archives.length ? (
          <div className="empty-state">No backups found on the host.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Taken</th>
                <th>Size</th>
                <th className="table__actions-col" />
              </tr>
            </thead>
            <tbody>
              {status.archives.map((a, i) => (
                <tr key={a.filename}>
                  <td>
                    <div className="table__primary">
                      {new Date(a.createdAt).toLocaleString()}
                      {i === 0 && <span className="tag tag--accent">latest</span>}
                    </div>
                    <div className="table__secondary">{a.filename}</div>
                  </td>
                  <td>{formatBytes(a.sizeBytes, 1)}</td>
                  <td>
                    <div className="table__actions">
                    <a className="btn btn--ghost btn--sm" href={`/api/backups/${encodeURIComponent(a.filename)}/download`}>
                      <Icon name="download" size={15} /> Download
                    </a>
                    {isAdmin && (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => void handleRestore(a.filename)}
                        disabled={!serverOffline || restoring !== null}
                        title={serverOffline ? 'Replace the world with this backup' : 'Stop the server first to restore'}
                      >
                        {restoring === a.filename ? <span className="spinner" /> : <Icon name="history" size={15} />} Restore
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isAdmin && !serverOffline && status?.archives.length ? (
          <p className="card__footnote muted">Restoring requires the server to be stopped.</p>
        ) : null}
      </section>

      {isAdmin && <BackupGatewaySettings status={status} onSave={saveConfig} />}

      <WorldBackupDownloader isOpen={worldDownloadOpen} onClose={() => setWorldDownloadOpen(false)} />
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile glass">
      <div className="tile__body">
        <span className="tile__label">{label}</span>
        <span className="tile__value">{value}</span>
        {hint && <span className="tile__hint">{hint}</span>}
      </div>
    </div>
  );
}

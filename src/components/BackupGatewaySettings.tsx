import { useEffect, useState } from 'react';
import type { BackupGatewayConfig, HostBackupStatus } from '../types/api';
import { useToasts } from '../context/ToastContext';

interface Props {
  status: HostBackupStatus | null;
  onSave: (cfg: Partial<BackupGatewayConfig>) => Promise<void>;
}

// Admin-only connection details for the host's mc-backup-gateway.
export function BackupGatewaySettings({ status, onSave }: Props) {
  const { push: toast } = useToasts();
  const [host, setHost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status) setHost(status.host);
  }, [status]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ host });
      toast({ kind: 'success', title: 'Backup host saved' });
    } catch (err) {
      toast({ kind: 'error', title: 'Could not save', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="card glass gateway-settings" open={status ? !status.configured : false}>
      <summary className="card__title">Backup host connection</summary>
      <p className="muted">
        The panel reaches the host over SSH with a key that can only run <code>mc-backup-gateway</code> (list, start,
        download). Status: {status?.reachable ? 'connected' : 'not connected'}
        {status?.server ? ` · server "${status.server}"` : ''}.
      </p>
      <form className="inline-form" onSubmit={(e) => void handleSave(e)}>
        <label className="field">
          <span className="field__label">Host (user@address)</span>
          <input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="root@192.168.0.99" />
        </label>
        <button className="btn btn--primary" disabled={saving || host === status?.host}>
          Save
        </button>
      </form>
    </details>
  );
}

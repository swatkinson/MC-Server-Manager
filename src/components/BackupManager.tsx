import React, { useState, useEffect, useCallback } from 'react';
import { useBackupManager } from '../hooks/useBackupManager';
import { useToasts } from '../context/ToastContext';
import { BackupRow } from './BackupRow';

interface BackupManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ isOpen, onClose }) => {
  const {
    config,
    backups,
    loading,
    saving,
    creating,
    restoring,
    deleting,
    saveConfig,
    createBackup,
    restoreBackup,
    deleteBackup,
    refetch,
  } = useBackupManager();

  const { push: pushToast } = useToasts();

  // Local form state
  const [backupDir, setBackupDir] = useState('');
  const [keepCount, setKeepCount] = useState(7);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [timeValue, setTimeValue] = useState('03:00');

  // Sync local state from loaded config
  useEffect(() => {
    if (config) {
      setBackupDir(config.backupDir);
      setKeepCount(config.keepCount);
      setScheduleEnabled(config.schedule.enabled);
      setTimeValue(toTimeValue(config.schedule.hour, config.schedule.minute));
    }
  }, [config]);

  // Refetch when modal opens
  useEffect(() => {
    if (isOpen) refetch();
  }, [isOpen, refetch]);

  const handleSaveSettings = useCallback(async () => {
    const [hourStr, minuteStr] = timeValue.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    try {
      await saveConfig({
        backupDir,
        keepCount,
        schedule: { enabled: scheduleEnabled, hour, minute },
      });
      pushToast({ kind: 'success', title: 'Backup settings saved' });
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Failed to save settings',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [saveConfig, backupDir, keepCount, scheduleEnabled, timeValue, pushToast]);

  const handleCreateBackup = useCallback(async () => {
    const result = await createBackup();
    if (result.success) {
      pushToast({ kind: 'success', title: 'Backup created successfully' });
    } else {
      pushToast({
        kind: 'error',
        title: 'Backup failed',
        message: result.error ?? 'Unknown error',
      });
    }
  }, [createBackup, pushToast]);

  const handleRestore = useCallback(async (filename: string) => {
    const result = await restoreBackup(filename);
    if (result.success) {
      pushToast({ kind: 'success', title: 'Restore completed', message: filename });
    } else {
      pushToast({
        kind: 'error',
        title: 'Restore failed',
        message: result.error ?? 'Unknown error',
      });
    }
  }, [restoreBackup, pushToast]);

  const handleDelete = useCallback(async (filename: string) => {
    const result = await deleteBackup(filename);
    if (result.success) {
      pushToast({ kind: 'success', title: 'Backup deleted' });
    } else {
      pushToast({
        kind: 'error',
        title: 'Delete failed',
        message: result.error ?? 'Unknown error',
      });
    }
  }, [deleteBackup, pushToast]);

  if (!isOpen) return null;

  const anyBusy = creating || restoring !== null || deleting !== null || saving;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="backup-manager-title">
        <div className="modal__header">
          <h2 className="modal__title" id="backup-manager-title">Backup Manager</h2>
          <button className="modal__close" onClick={onClose} disabled={anyBusy} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal__content">
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}

          {!loading && (
            <>
              {/* Backup Directory */}
              <div className="whitelist-section">
                <p className="whitelist-section__title">HDD Backup Directory</p>
                <input
                  type="text"
                  className="property-input"
                  placeholder="/mnt/backups"
                  value={backupDir}
                  onChange={(e) => setBackupDir(e.target.value)}
                  disabled={saving}
                  aria-label="HDD Backup Directory"
                />
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Backups are stored as <code>mc-backups/*.tar.gz</code> within this directory.
                </p>
              </div>

              {/* Retention */}
              <div className="whitelist-section">
                <p className="whitelist-section__title">Keep last N backups (oldest auto-deleted)</p>
                <input
                  type="number"
                  className="property-input"
                  min={1}
                  max={30}
                  value={keepCount}
                  onChange={(e) => setKeepCount(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                  disabled={saving}
                  aria-label="Number of backups to keep"
                  style={{ width: '6rem' }}
                />
              </div>

              {/* Schedule */}
              <div className="whitelist-section">
                <div className="whitelist-toggle">
                  <div className="whitelist-toggle__label">
                    <span>Daily automatic backup</span>
                    <span className="whitelist-toggle__description">
                      Create a backup once per day at the configured time
                    </span>
                  </div>
                  <button
                    className={`toggle${scheduleEnabled ? ' toggle--active' : ''}`}
                    onClick={() => setScheduleEnabled((v) => !v)}
                    disabled={saving}
                    aria-pressed={scheduleEnabled}
                    aria-label="Toggle automatic backup"
                  >
                    <span className="toggle__slider" />
                  </button>
                </div>

                {scheduleEnabled && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <input
                      type="time"
                      className="property-input scheduler-time-input"
                      value={timeValue}
                      onChange={(e) => setTimeValue(e.target.value)}
                      disabled={saving}
                      aria-label="Daily backup time"
                    />
                  </div>
                )}
              </div>

              {/* Save settings button */}
              <div className="whitelist-section" style={{ border: 'none', paddingTop: 0 }}>
                <button
                  className="btn btn--blue btn--small"
                  onClick={() => void handleSaveSettings()}
                  disabled={saving || loading}
                >
                  {saving ? (
                    <>
                      <span className="btn-spinner" />
                      Saving…
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>

              {/* Backup Now */}
              <div className="whitelist-section">
                <p className="whitelist-section__title">Actions</p>
                <button
                  className="btn btn--blue"
                  onClick={() => void handleCreateBackup()}
                  disabled={anyBusy}
                >
                  {creating ? (
                    <>
                      <span className="btn-spinner" />
                      Creating backup…
                    </>
                  ) : (
                    'Backup Now'
                  )}
                </button>
              </div>

              {/* Backup list */}
              <div className="whitelist-section">
                <p className="whitelist-section__title">
                  Stored Backups{backups.length > 0 ? ` (${backups.length})` : ''}
                </p>
                {backups.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No backups found.
                  </p>
                ) : (
                  <div className="accounts-table__wrapper">
                    <table className="accounts-table">
                      <thead>
                        <tr>
                          <th className="accounts-table__th">Filename</th>
                          <th className="accounts-table__th">Size</th>
                          <th className="accounts-table__th">Created</th>
                          <th className="accounts-table__th" />
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map((backup) => (
                          <BackupRow
                            key={backup.filename}
                            filename={backup.filename}
                            sizeBytes={backup.sizeBytes}
                            createdAt={backup.createdAt}
                            isRestoring={restoring === backup.filename}
                            isDeleting={deleting === backup.filename}
                            anyBusy={anyBusy}
                            onRestore={handleRestore}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <div className="modal__actions">
            <button className="btn btn--gray" onClick={onClose} disabled={anyBusy}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

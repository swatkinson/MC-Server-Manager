import React, { useState, useEffect, useCallback } from 'react';
import { useRestartScheduler } from '../hooks/useRestartScheduler';

interface RestartSchedulerEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function formatCountdown(isoString: string): string {
  const ms = new Date(isoString).getTime() - Date.now();
  if (ms <= 0) return 'imminent';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export const RestartSchedulerEditor: React.FC<RestartSchedulerEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const { schedule, loading, saving, updateSchedule, triggerRestart } = useRestartScheduler();

  const [enabled, setEnabled] = useState(false);
  const [timeValue, setTimeValue] = useState('04:00');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (schedule) {
      setEnabled(schedule.enabled);
      setTimeValue(toTimeValue(schedule.hour, schedule.minute));
    }
  }, [schedule]);

  useEffect(() => {
    if (!schedule?.nextRestart || !schedule.enabled) {
      setCountdown('');
      return;
    }
    const update = () => setCountdown(formatCountdown(schedule.nextRestart!));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [schedule?.nextRestart, schedule?.enabled]);

  const handleSave = useCallback(async () => {
    const [hourStr, minuteStr] = timeValue.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    await updateSchedule({ enabled, hour, minute });
  }, [updateSchedule, enabled, timeValue]);

  const handleRestart = useCallback(async () => {
    await triggerRestart();
  }, [triggerRestart]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scheduler-title">
        <div className="modal__header">
          <h2 className="modal__title" id="scheduler-title">Restart Scheduler</h2>
          <button className="modal__close" onClick={onClose} disabled={saving} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal__content">
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading schedule…</p>}

          {!loading && (
            <>
              <div className="whitelist-section">
                <div className="whitelist-toggle">
                  <div className="whitelist-toggle__label">
                    <span>Daily automatic restart</span>
                    <span className="whitelist-toggle__description">
                      Restart the server once per day at the configured time
                    </span>
                  </div>
                  <button
                    className={`toggle${enabled ? ' toggle--active' : ''}`}
                    onClick={() => setEnabled((v) => !v)}
                    disabled={saving}
                    aria-pressed={enabled}
                    aria-label="Toggle automatic restart"
                  >
                    <span className="toggle__slider" />
                  </button>
                </div>
              </div>

              <div className="whitelist-section">
                <p className="whitelist-section__title">Restart time (server local time)</p>
                <input
                  type="time"
                  className="property-input scheduler-time-input"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  disabled={saving || !enabled}
                  aria-label="Daily restart time"
                />
              </div>

              {enabled && schedule?.nextRestart && (
                <div className="whitelist-section">
                  <p className="whitelist-section__title">Next restart</p>
                  <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem' }}>
                    {new Date(schedule.nextRestart).toLocaleString()}
                  </p>
                  {countdown && (
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      in {countdown}
                    </p>
                  )}
                </div>
              )}

              <div className="whitelist-section" style={{ background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Players receive an in-game warning 5 minutes and 1 minute before each restart.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--gray btn--small" onClick={handleRestart} disabled={saving}>
            Restart Now
          </button>
          <div className="modal__actions">
            <button className="btn btn--gray" onClick={onClose} disabled={saving}>
              Close
            </button>
            <button className="btn btn--blue" onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <span className="btn-spinner" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { useDiscordWebhook, DiscordWebhookConfig } from '../hooks/useDiscordWebhook';
import { useToasts } from '../context/ToastContext';

interface WebhooksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type EventsConfig = DiscordWebhookConfig['events'];

const EVENT_LABELS: { key: keyof EventsConfig; label: string }[] = [
  { key: 'serverStart', label: 'Server Start' },
  { key: 'serverStop', label: 'Server Stop' },
  { key: 'serverCrash', label: 'Server Crash' },
  { key: 'scheduledRestart', label: 'Scheduled Restart' },
  { key: 'backupSuccess', label: 'Backup Success' },
  { key: 'backupFailed', label: 'Backup Failed' },
];

const DEFAULT_EVENTS: EventsConfig = {
  serverStart: true,
  serverStop: true,
  serverCrash: true,
  scheduledRestart: true,
  backupSuccess: true,
  backupFailed: true,
};

export const WebhooksPanel: React.FC<WebhooksPanelProps> = ({ isOpen, onClose }) => {
  const { config, loading, saving, testing, saveConfig, testWebhook } = useDiscordWebhook();
  const { push } = useToasts();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<EventsConfig>({ ...DEFAULT_EVENTS });

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl);
      setEnabled(config.enabled);
      setEvents({ ...config.events });
    }
  }, [config]);

  const handleEventChange = useCallback(
    (key: keyof EventsConfig, checked: boolean) => {
      setEvents((prev) => ({ ...prev, [key]: checked }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    try {
      await saveConfig({ webhookUrl, enabled, events });
      push({ kind: 'success', title: 'Webhook settings saved.' });
    } catch (err) {
      push({
        kind: 'error',
        title: 'Failed to save webhook settings.',
        message: err instanceof Error ? err.message : undefined,
      });
    }
  }, [saveConfig, webhookUrl, enabled, events, push]);

  const handleTest = useCallback(async () => {
    const result = await testWebhook();
    if (result.success) {
      push({ kind: 'success', title: 'Test message sent to Discord.' });
    } else {
      push({
        kind: 'error',
        title: 'Webhook test failed.',
        message: result.error,
      });
    }
  }, [testWebhook, push]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="webhooks-title">
        <div className="modal__header">
          <h2 className="modal__title" id="webhooks-title">Discord Webhook Notifications</h2>
          <button
            className="modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal__content">
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading webhook settings…</p>}

          {!loading && (
            <>
              <div className="whitelist-section">
                <p className="whitelist-section__title">Discord Webhook URL</p>
                <input
                  type="url"
                  className="property-input"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={saving}
                  aria-label="Discord Webhook URL"
                />
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  To create a webhook: Discord Server → Edit → Integrations → Webhooks → New Webhook → Copy URL
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                  <a
                    href="https://discord.com/developers/docs/resources/webhook"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Discord documentation ↗
                  </a>
                </p>
              </div>

              <div className="whitelist-section">
                <div className="whitelist-toggle">
                  <div className="whitelist-toggle__label">
                    <span>Enable notifications</span>
                  </div>
                  <button
                    className={`toggle${enabled ? ' toggle--active' : ''}`}
                    onClick={() => setEnabled((v) => !v)}
                    disabled={saving}
                    aria-pressed={enabled}
                    aria-label="Toggle Discord notifications"
                  >
                    <span className="toggle__slider" />
                  </button>
                </div>
              </div>

              <div className="whitelist-section">
                <p className="whitelist-section__title">Notify on events</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {EVENT_LABELS.map(({ key, label }) => (
                    <li key={key}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                        <input
                          type="checkbox"
                          checked={events[key]}
                          onChange={(e) => handleEventChange(key, e.target.checked)}
                          disabled={saving}
                        />
                        {label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <button
            className="btn btn--gray btn--small"
            onClick={handleTest}
            disabled={saving || testing || loading}
          >
            {testing ? (
              <>
                <span className="btn-spinner" />
                Sending…
              </>
            ) : (
              'Send Test'
            )}
          </button>
          <div className="modal__actions">
            <button className="btn btn--gray" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn--blue"
              onClick={handleSave}
              disabled={saving || loading}
            >
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

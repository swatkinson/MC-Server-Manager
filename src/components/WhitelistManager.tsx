import React, { useState } from 'react';
import { useWhitelist } from '../hooks/useWhitelist';
import '../styles/config-panel.css';

interface WhitelistManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const WhitelistManager: React.FC<WhitelistManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { entries, enabled, updating, addPlayer, removePlayer, toggleWhitelist } = useWhitelist();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerUuid, setNewPlayerUuid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [removingUuid, setRemovingUuid] = useState<string | null>(null);

  const validateUuid = (uuid: string): boolean => {
    return UUID_REGEX.test(uuid);
  };

  const handleAddPlayer = async () => {
    setError(null);
    setSuccess(false);

    if (!newPlayerName.trim()) {
      setError('Player name is required');
      return;
    }

    if (!newPlayerUuid.trim()) {
      setError('Player UUID is required');
      return;
    }

    if (!validateUuid(newPlayerUuid)) {
      setError('Invalid UUID format');
      return;
    }

    if (entries.some(e => e.uuid.toLowerCase() === newPlayerUuid.toLowerCase())) {
      setError('Player is already whitelisted');
      return;
    }

    try {
      await addPlayer(newPlayerUuid, newPlayerName);
      setNewPlayerName('');
      setNewPlayerUuid('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player');
    }
  };

  const handleRemovePlayer = async (uuid: string) => {
    setRemovingUuid(uuid);
    try {
      setError(null);
      await removePlayer(uuid);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove player');
    } finally {
      setRemovingUuid(null);
    }
  };

  const handleToggleWhitelist = async () => {
    try {
      setError(null);
      await toggleWhitelist(!enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle whitelist');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--large" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Whitelist Manager</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="modal__error">
            <span className="modal__error-icon">✕</span>
            {error}
          </div>
        )}

        {success && (
          <div className="modal__success">
            <span className="modal__success-icon">✓</span>
            Changes applied successfully!
          </div>
        )}

        <div className="modal__content">
          {/* Whitelist Toggle */}
          <div className="whitelist-section">
            <div className="whitelist-toggle">
              <div className="whitelist-toggle__label">
                <span>Whitelist Enforcement</span>
                <span className="whitelist-toggle__description">
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <button
                className={`toggle ${enabled ? 'toggle--active' : ''}`}
                onClick={handleToggleWhitelist}
                disabled={updating}
              >
                <span className="toggle__slider" />
              </button>
            </div>
          </div>

          {/* Add Player Section */}
          <div className="whitelist-section">
            <h3 className="whitelist-section__title">Add Player to Whitelist</h3>
            <div className="whitelist-form">
              <input
                type="text"
                className="whitelist-form__input"
                placeholder="Player Name"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                disabled={updating}
              />
              <input
                type="text"
                className="whitelist-form__input"
                placeholder="Player UUID"
                value={newPlayerUuid}
                onChange={e => setNewPlayerUuid(e.target.value)}
                disabled={updating}
              />
              <button
                className="btn btn--blue"
                onClick={handleAddPlayer}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <span className="btn-spinner" />
                    Adding...
                  </>
                ) : (
                  'Add Player'
                )}
              </button>
            </div>
          </div>

          {/* Players List */}
          <div className="whitelist-section">
            <h3 className="whitelist-section__title">
              Whitelisted Players ({entries.length})
            </h3>
            {entries.length === 0 ? (
              <div className="whitelist-empty">
                <p>No players whitelisted yet</p>
              </div>
            ) : (
              <div className="whitelist-list">
                {entries.map(entry => (
                  <div key={entry.uuid} className="whitelist-item">
                    <div className="whitelist-item__info">
                      <div className="whitelist-item__name">{entry.name}</div>
                      <div className="whitelist-item__uuid">{entry.uuid}</div>
                    </div>
                    <button
                      className="btn btn--red btn--small"
                      onClick={() => handleRemovePlayer(entry.uuid)}
                      disabled={updating || removingUuid === entry.uuid}
                      title="Remove from whitelist"
                    >
                      {removingUuid === entry.uuid ? (
                        <>
                          <span className="btn-spinner" />
                          Removing...
                        </>
                      ) : (
                        'Remove'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--gray" onClick={onClose} disabled={updating}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

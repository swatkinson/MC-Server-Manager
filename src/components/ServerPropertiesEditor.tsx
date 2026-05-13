import React, { useState, useEffect } from 'react';
import { ServerProperties, useServerConfig } from '../hooks/useServerConfig';
import '../styles/config-panel.css';

interface ServerPropertiesEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerPropertiesEditor: React.FC<ServerPropertiesEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const { properties, saving, saveProperties } = useServerConfig();
  const [editedProperties, setEditedProperties] = useState<ServerProperties>({});
  const [backup, setBackup] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (properties) {
      setEditedProperties({ ...properties });
      setError(null);
      setSuccess(false);
    }
  }, [properties, isOpen]);

  const handlePropertyChange = (key: string, value: string) => {
    setEditedProperties(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(false);
      await saveProperties(editedProperties, backup);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save properties');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Edit Server Properties</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        <div className="modal__warning">
          <span className="modal__warning-icon">⚠</span>
          <span>Changes require server restart to take effect</span>
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
            Properties saved successfully!
          </div>
        )}

        <div className="modal__content">
          <div className="properties-grid">
            {Object.entries(editedProperties).map(([key, value]) => (
              <div key={key} className="property-row">
                <label className="property-label">{key}</label>
                <input
                  type="text"
                  className="property-input"
                  value={String(value)}
                  onChange={e => handlePropertyChange(key, e.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="modal__footer">
          <div className="modal__checkbox">
            <input
              type="checkbox"
              id="backup-checkbox"
              checked={backup}
              onChange={e => setBackup(e.target.checked)}
              disabled={saving}
            />
            <label htmlFor="backup-checkbox">Create backup before saving</label>
          </div>

          <div className="modal__actions">
            <button
              className="btn btn--gray"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn btn--blue"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="btn-spinner" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

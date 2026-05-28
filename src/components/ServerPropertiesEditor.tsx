import React, { useState, useEffect } from 'react';
import { ServerProperties, useServerConfig } from '../hooks/useServerConfig';
import {
  getPropertyDescription,
  PropertyDescription,
} from '../data/serverPropertyDescriptions';
import '../styles/config-panel.css';
import { PropertyTooltip, ActiveTooltip, TOOLTIP_GAP, TOOLTIP_MAX_WIDTH } from './PropertyTooltip';

interface ServerPropertiesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  serverRunning?: boolean;
}

export const ServerPropertiesEditor: React.FC<ServerPropertiesEditorProps> = ({
  isOpen,
  onClose,
  serverRunning = false,
}) => {
  const { properties, saving, saveProperties } = useServerConfig();
  const [editedProperties, setEditedProperties] = useState<ServerProperties>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);

  useEffect(() => {
    if (properties) {
      setEditedProperties({ ...properties });
      setError(null);
      setSuccess(false);
    }
  }, [properties, isOpen]);

  useEffect(() => {
    if (!isOpen) setActiveTooltip(null);
  }, [isOpen]);

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
      await saveProperties(editedProperties, false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save properties');
    }
  };

  const showTooltip = (
    target: HTMLElement,
    key: string,
    info: PropertyDescription
  ) => {
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const halfWidth = TOOLTIP_MAX_WIDTH / 2;
    const iconCenter = rect.left + rect.width / 2;
    const left = Math.max(
      halfWidth + 8,
      Math.min(iconCenter, viewportWidth - halfWidth - 8)
    );
    setActiveTooltip({
      key,
      info,
      top: rect.top - TOOLTIP_GAP,
      left,
    });
  };

  const hideTooltip = () => setActiveTooltip(null);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Edit Server Properties</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        {serverRunning && (
          <div className="modal__warning">
            <span className="modal__warning-icon">⚠</span>
            <span>Changes require server restart to take effect</span>
          </div>
        )}

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
            {Object.entries(editedProperties).map(([key, value]) => {
              const info = getPropertyDescription(key);
              return (
                <div key={key} className="property-row">
                  <label className="property-label" htmlFor={`prop-${key}`}>
                    <span className="property-label__text">{key}</span>
                    {info && (
                      <button
                        type="button"
                        className="property-info"
                        aria-label={`Info about ${key}`}
                        onMouseEnter={e => showTooltip(e.currentTarget, key, info)}
                        onMouseLeave={hideTooltip}
                        onFocus={e => showTooltip(e.currentTarget, key, info)}
                        onBlur={hideTooltip}
                        onClick={e => e.preventDefault()}
                      >
                        <span aria-hidden="true">?</span>
                      </button>
                    )}
                  </label>
                  <input
                    id={`prop-${key}`}
                    type="text"
                    className="property-input"
                    value={String(value)}
                    onChange={e => handlePropertyChange(key, e.target.value)}
                    disabled={saving}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal__footer">
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
      {activeTooltip && <PropertyTooltip tooltip={activeTooltip} />}
    </div>
  );
};

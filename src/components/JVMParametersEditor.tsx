import React, { useState, useEffect } from 'react';
import { useStartupScript } from '../hooks/useStartupScript';
import { StartupScriptConfig } from '../types/api';
import '../styles/config-panel.css';

interface JVMParametersEditorProps {
  isOpen: boolean;
  onClose: () => void;
  serverRunning?: boolean;
}

function buildPreview(xms: string, xmx: string, jar: string, extraFlags: string, launchMode: 'simple' | 'forge'): string {
  const parts = ['java'];
  if (xms) parts.push(`-Xms${xms}`);
  if (xmx) parts.push(`-Xmx${xmx}`);
  if (extraFlags.trim()) parts.push(extraFlags.trim());
  if (launchMode === 'simple' && jar) parts.push('-jar', jar, 'nogui');
  return parts.join(' ');
}

export const JVMParametersEditor: React.FC<JVMParametersEditorProps> = ({
  isOpen,
  onClose,
  serverRunning = false,
}) => {
  const { config, loading, saving, saveError, save } = useStartupScript();

  const [xms, setXms] = useState('');
  const [xmx, setXmx] = useState('');
  const [jar, setJar] = useState('');
  const [extraFlags, setExtraFlags] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setXms(config.xms);
      setXmx(config.xmx);
      setJar(config.jar);
      setExtraFlags(config.extraFlags);
    }
  }, [config]);

  if (!isOpen) return null;

  const launchMode = config?.launchMode ?? 'simple';
  const isForge = launchMode === 'forge';
  const preview = buildPreview(xms, xmx, jar, extraFlags, launchMode);
  const isDirty =
    xms !== (config?.xms ?? '') ||
    xmx !== (config?.xmx ?? '') ||
    (!isForge && jar !== (config?.jar ?? '')) ||
    extraFlags !== (config?.extraFlags ?? '');

  const saveDisabled = saving || !isDirty || (!isForge && !jar.trim());

  async function handleSave() {
    const ok = await save({ xms, xmx, jar, extraFlags });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--medium" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">JVM Parameters</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        {serverRunning && (
          <div className="modal__warning">
            <span className="modal__warning-icon">⚠</span>
            <span>Changes require a server restart to take effect</span>
          </div>
        )}

        <div className="modal__content">
          {loading ? (
            <p className="jvm-section__description">Loading startup script…</p>
          ) : (
            <>
              <div className="jvm-section">
                <h3 className="jvm-section__title">Memory</h3>
                <div className="jvm-fields">
                  <label className="jvm-field">
                    <span className="jvm-field__label">Startup RAM <code>-Xms</code></span>
                    <input
                      className="jvm-field__input"
                      type="text"
                      value={xms}
                      onChange={e => setXms(e.target.value)}
                      placeholder="e.g. 2G"
                    />
                  </label>
                  <label className="jvm-field">
                    <span className="jvm-field__label">Max RAM <code>-Xmx</code></span>
                    <input
                      className="jvm-field__input"
                      type="text"
                      value={xmx}
                      onChange={e => setXmx(e.target.value)}
                      placeholder="e.g. 8G"
                    />
                  </label>
                </div>
              </div>

              {!isForge && (
                <div className="jvm-section">
                  <h3 className="jvm-section__title">JAR File</h3>
                  <label className="jvm-field">
                    <span className="jvm-field__label">JAR filename</span>
                    <input
                      className="jvm-field__input"
                      type="text"
                      value={jar}
                      onChange={e => setJar(e.target.value)}
                      placeholder="e.g. paper-1.21.jar"
                    />
                  </label>
                </div>
              )}

              <div className="jvm-section">
                <h3 className="jvm-section__title">Extra JVM Flags</h3>
                <textarea
                  className="jvm-field__textarea"
                  value={extraFlags}
                  onChange={e => setExtraFlags(e.target.value)}
                  placeholder="-XX:+UseG1GC -XX:ParallelGCThreads=4"
                  rows={3}
                />
              </div>

              <div className="jvm-section">
                <h3 className="jvm-section__title">Command Preview</h3>
                <code className="jvm-command-example">{preview || '(fill in the fields above)'}</code>
                {isForge && (
                  <p className="jvm-section__description">Saved to <code>user_jvm_args.txt</code> — Forge manages the rest of the launch command.</p>
                )}
              </div>

              {saveError && (
                <p className="jvm-error">{saveError}</p>
              )}
            </>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--gray" onClick={onClose}>
            Close
          </button>
          {!loading && (
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saveDisabled}
            >
              {saving ? 'Saving…' : saved ? 'Saved!' : isForge ? 'Save to user_jvm_args.txt' : 'Save to start.sh'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { useModConfigs } from '../hooks/useModConfigs';
import { useToasts } from '../context/ToastContext';
import { ConfigFileTree } from '../components/ConfigFileTree';
import { CodeEditor } from '../components/CodeEditor';
import { Icon } from '../components/icons/Icon';
import { formatBytes, formatRelative } from '../utils/formatting';
import type { ModConfigVersion } from '../types/api';

function jsonProblem(path: string, text: string): string | null {
  if (!path.toLowerCase().endsWith('.json')) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON';
  }
}

export function ModConfigsPage() {
  const { roots, loading, error, refetch, file, fileLoading, open, save, listVersions, readVersion } = useModConfigs();
  const { push: toast } = useToasts();
  const [rootId, setRootId] = useState('config');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<ModConfigVersion[] | null>(null);

  const root = roots.find((r) => r.id === rootId) ?? roots[0];
  const dirty = file !== null && draft !== file.content;
  const problem = useMemo(() => (file ? jsonProblem(file.path, draft) : null), [file, draft]);
  const meta = file ? root?.files.find((f) => f.path === file.path) : undefined;

  useEffect(() => {
    if (file) setDraft(file.content);
    setVersions(null);
  }, [file]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes to this file?');

  async function handleSelect(path: string) {
    if (!root || (file?.path === path && file.root === root.id) || !confirmDiscard()) return;
    try {
      await open(root.id, path);
    } catch (err) {
      toast({ kind: 'error', title: 'Could not open file', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleSave() {
    if (!file || !dirty || saving) return;
    if (problem && !window.confirm(`This JSON doesn't parse:\n\n${problem}\n\nThe mod may reset or ignore the file. Save anyway?`)) return;
    setSaving(true);
    try {
      await save(draft);
      toast({ kind: 'success', title: 'Saved', message: `${file.path} — Forge reloads most .toml configs live; other files apply on restart.` });
      void refetch();
    } catch (err) {
      toast({ kind: 'error', title: 'Save failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    if (!file || !confirmDiscard()) return;
    await open(file.root, file.path);
  }

  async function toggleVersions() {
    if (versions) {
      setVersions(null);
      return;
    }
    try {
      setVersions(await listVersions());
    } catch (err) {
      toast({ kind: 'error', title: 'Could not load history', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function loadVersion(v: ModConfigVersion) {
    if (!confirmDiscard()) return;
    setDraft(await readVersion(v.id));
    setVersions(null);
    toast({ kind: 'info', title: 'Previous version loaded', message: 'Review it, then Save to restore it.' });
  }

  return (
    <div className="configs-page">
      <aside className="card glass configs-page__browser">
        <div className="segmented segmented--full" role="tablist" aria-label="Config folder">
          {roots.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === root?.id}
              className={`segmented__btn ${r.id === root?.id ? 'segmented__btn--active' : ''}`}
              onClick={() => setRootId(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {root && <p className="configs-page__root-hint">{root.description}</p>}
        <label className="search-field">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder={`Search ${root?.files.length ?? 0} files…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="configs-page__tree">
          {loading && !roots.length ? (
            <div className="empty-state empty-state--small">Loading files…</div>
          ) : error ? (
            <div className="empty-state empty-state--small">{error}</div>
          ) : root && root.files.length === 0 ? (
            <div className="empty-state empty-state--small">This folder is empty.</div>
          ) : (
            root && (
              <ConfigFileTree
                files={root.files}
                query={query}
                selected={file?.root === root.id ? file.path : null}
                onSelect={(p) => void handleSelect(p)}
              />
            )
          )}
        </div>
      </aside>

      <section className="card glass configs-page__editor">
        {!file ? (
          <div className="empty-state configs-page__placeholder">
            <Icon name="files" size={36} />
            <p>Pick a config file on the left to view or edit it.</p>
            <p className="muted">Every save keeps the previous version, so changes can be rolled back.</p>
          </div>
        ) : (
          <>
            <header className="editor-bar">
              <div className="editor-bar__file">
                <span className="editor-bar__path">
                  {roots.find((r) => r.id === file.root)?.label}
                  <strong>{file.path}</strong>
                </span>
                <span className="editor-bar__meta">
                  {meta && `${formatBytes(meta.size, 1)} · modified ${formatRelative(file.mtimeMs)}`}
                  {dirty && <span className="tag tag--warn">Unsaved</span>}
                  {problem && <span className="tag tag--bad" title={problem}>Invalid JSON</span>}
                </span>
              </div>
              <div className="editor-bar__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => void toggleVersions()}>
                  <Icon name="history" size={15} /> History
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => void handleReload()} disabled={fileLoading}>
                  Reload
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setDraft(file.content)} disabled={!dirty}>
                  Revert
                </button>
                <button className="btn btn--primary btn--sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
                  {saving && <span className="spinner" />} Save
                </button>
              </div>
            </header>

            {versions && (
              <div className="versions">
                {versions.length === 0 ? (
                  <span className="muted">No earlier versions yet — one is kept every time you save.</span>
                ) : (
                  versions.map((v) => (
                    <button key={v.id} className="versions__item" onClick={() => void loadVersion(v)}>
                      {new Date(v.savedAt).toLocaleString()} <span className="muted">{formatBytes(v.size, 1)}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <CodeEditor value={draft} onChange={setDraft} onSave={() => void handleSave()} />
            <footer className="editor-foot muted">Ctrl/⌘ + S to save · Tab inserts a tab</footer>
          </>
        )}
      </section>
    </div>
  );
}

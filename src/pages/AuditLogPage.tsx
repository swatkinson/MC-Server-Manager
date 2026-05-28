import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';
import { useAuditLog } from '../hooks/useAuditLog';

const PAGE_SIZE = 25;

function formatDetails(details: Record<string, unknown>): string {
  const raw = JSON.stringify(details);
  if (raw.length <= 80) return raw;
  return raw.slice(0, 80) + '…';
}

export function AuditLogPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { entries, total, loading, error, refetch } = useAuditLog(PAGE_SIZE, page);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  if (user?.role !== 'admin') {
    return (
      <div className="accounts-page">
        <div className="accounts-page__header">
          <h1 className="accounts-page__title">Audit Log</h1>
          <button className="btn btn--gray" onClick={() => void navigate({ to: '/' })}>
            ← Back to Dashboard
          </button>
        </div>
        <p style={{ color: 'var(--red)' }}>Access denied.</p>
      </div>
    );
  }

  return (
    <div className="accounts-page">
      <div className="accounts-page__header">
        <h1 className="accounts-page__title">Audit Log</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn--gray" onClick={refetch}>
            Refresh
          </button>
          <button className="btn btn--gray" onClick={() => void navigate({ to: '/' })}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="card">
        {loading && <p className="accounts-page__loading">Loading…</p>}
        {error && <div className="auth-form__error">{error}</div>}
        {!loading && !error && (
          <>
            <div className="accounts-table__wrapper">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th className="accounts-table__th">Time</th>
                    <th className="accounts-table__th">User</th>
                    <th className="accounts-table__th">Role</th>
                    <th className="accounts-table__th">Action</th>
                    <th className="accounts-table__th">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr className="accounts-table__row">
                      <td className="accounts-table__td accounts-table__td--muted" colSpan={5}>
                        No audit entries found.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="accounts-table__row">
                        <td className="accounts-table__td accounts-table__td--muted">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="accounts-table__td">
                          {entry.username != null ? (
                            <span className="accounts-table__username">@{entry.username}</span>
                          ) : (
                            <span className="accounts-table__td--muted">—</span>
                          )}
                        </td>
                        <td className="accounts-table__td">
                          {entry.role != null ? (
                            <span className="accounts-table__role-badge">
                              {entry.role.charAt(0).toUpperCase() + entry.role.slice(1)}
                            </span>
                          ) : (
                            <span className="accounts-table__td--muted">—</span>
                          )}
                        </td>
                        <td className="accounts-table__td">
                          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="accounts-table__td accounts-table__td--muted">
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {formatDetails(entry.details)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1rem',
                gap: '0.5rem',
              }}
            >
              <span className="accounts-table__td--muted" style={{ fontSize: '0.875rem' }}>
                {total === 0
                  ? 'No entries'
                  : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn--gray"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!hasPrev}
                >
                  Previous
                </button>
                <button
                  className="btn btn--gray"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

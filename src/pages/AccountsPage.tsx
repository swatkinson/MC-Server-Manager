import { useState, FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../context/AuthContext';
import type { PublicUser } from '../types/api';

function AccountRow({
  account,
  currentUserId,
  deleting,
  onDelete,
}: {
  account: PublicUser;
  currentUserId: string | undefined;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isSelf = account.id === currentUserId;

  return (
    <tr className="accounts-table__row">
      <td className="accounts-table__td">
        <span className="accounts-table__username">@{account.username}</span>
        {isSelf && <span className="accounts-table__you-badge">you</span>}
      </td>
      <td className="accounts-table__td">
        <span className="accounts-table__role-badge">Admin</span>
      </td>
      <td className="accounts-table__td accounts-table__td--muted">
        {new Date(account.createdAt).toLocaleDateString()}
      </td>
      <td className="accounts-table__td accounts-table__td--actions">
        {!isSelf &&
          (confirming ? (
            <span className="accounts-table__confirm">
              <span className="accounts-table__confirm-text">Delete?</span>
              <button
                className="btn btn--red accounts-table__btn"
                onClick={() => onDelete(account.id)}
                disabled={deleting}
              >
                {deleting ? <span className="control-buttons__spinner-small" /> : 'Yes, delete'}
              </button>
              <button
                className="btn btn--gray accounts-table__btn"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="btn btn--red accounts-table__btn"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          ))}
      </td>
    </tr>
  );
}

function CreateAccountForm({
  creating,
  onSubmit,
}: {
  creating: boolean;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(username, password);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="card">
      <h2>Create New Account</h2>
      <form className="accounts-create-form" onSubmit={(e) => void handleSubmit(e)}>
        {error && <div className="auth-form__error">{error}</div>}
        <div className="accounts-create-form__fields">
          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="new-username">
              Username
            </label>
            <input
              id="new-username"
              className="auth-form__input"
              type="text"
              autoComplete="off"
              placeholder="3–32 chars, letters/numbers/_"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={creating}
              required
            />
          </div>
          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="new-password">
              Password
            </label>
            <input
              id="new-password"
              className="auth-form__input"
              type="password"
              autoComplete="new-password"
              placeholder="8+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={creating}
              required
            />
          </div>
        </div>
        <button className="btn btn--blue" type="submit" disabled={creating}>
          {creating ? <><span className="control-buttons__spinner-small" /> Creating…</> : 'Create Account'}
        </button>
      </form>
    </div>
  );
}

export function AccountsPage() {
  const { user } = useAuth();
  const { users, loading, error, creating, deleting, createUser, deleteUser } = useAccounts();
  const navigate = useNavigate();

  return (
    <div className="accounts-page">
      <div className="accounts-page__header">
        <h1 className="accounts-page__title">Account Management</h1>
        <button className="btn btn--gray" onClick={() => void navigate({ to: '/' })}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="card">
        <h2>Accounts</h2>
        {loading && <p className="accounts-page__loading">Loading…</p>}
        {error && <div className="auth-form__error">{error}</div>}
        {!loading && !error && (
          <div className="accounts-table__wrapper">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th className="accounts-table__th">Username</th>
                  <th className="accounts-table__th">Role</th>
                  <th className="accounts-table__th">Created</th>
                  <th className="accounts-table__th" />
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    currentUserId={user?.id}
                    deleting={deleting.has(account.id)}
                    onDelete={deleteUser}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateAccountForm creating={creating} onSubmit={createUser} />
    </div>
  );
}

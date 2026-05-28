import { useState, FormEvent } from 'react';

interface CreateAccountFormProps {
  creating: boolean;
  onSubmit: (username: string, password: string, role: 'admin' | 'moderator' | 'user') => Promise<void>;
}

export function CreateAccountForm({
  creating,
  onSubmit,
}: CreateAccountFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'moderator' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(username, password, role);
      setUsername('');
      setPassword('');
      setRole('user');
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
          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="new-role">
              Role
            </label>
            <select
              id="new-role"
              className="auth-form__input"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'moderator' | 'user')}
              disabled={creating}
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button className="btn btn--blue" type="submit" disabled={creating}>
          {creating ? <><span className="control-buttons__spinner-small" /> Creating…</> : 'Create Account'}
        </button>
      </form>
    </div>
  );
}

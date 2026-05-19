import { useState, FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { setupRequired, login, setup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSetup = setupRequired === true;
  const title = isSetup ? 'Create Admin Account' : 'Sign In';
  const subtitle = isSetup
    ? 'No accounts exist yet. Create the first admin account.'
    : 'MC Server Manager';
  const buttonLabel = isSetup ? 'Create Account' : 'Sign In';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSetup) {
        await setup(username, password);
      } else {
        await login(username, password);
      }
      await navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <h1 className="auth-card__title">{title}</h1>
          <p className="auth-card__subtitle">{subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          {error && <div className="auth-form__error">{error}</div>}

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="auth-form__input"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="auth-form__input"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <button className="auth-form__submit" type="submit" disabled={submitting}>
            {submitting && <span className="auth-form__spinner" />}
            {submitting ? (isSetup ? 'Creating…' : 'Signing in…') : buttonLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useNavigate } from '@tanstack/react-router';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../context/AuthContext';
import { AccountRow } from '../components/AccountRow';
import { CreateAccountForm } from '../components/CreateAccountForm';

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

      <CreateAccountForm creating={creating} onSubmit={(u, p, r) => createUser(u, p, r)} />
    </div>
  );
}

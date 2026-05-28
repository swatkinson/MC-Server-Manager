import { useState } from 'react';
import type { PublicUser } from '../types/api';

interface AccountRowProps {
  account: PublicUser;
  currentUserId: string | undefined;
  deleting: boolean;
  onDelete: (id: string) => void;
}

export function AccountRow({
  account,
  currentUserId,
  deleting,
  onDelete,
}: AccountRowProps) {
  const [confirming, setConfirming] = useState(false);
  const isSelf = account.id === currentUserId;

  return (
    <tr className="accounts-table__row">
      <td className="accounts-table__td">
        <span className="accounts-table__username">@{account.username}</span>
        {isSelf && <span className="accounts-table__you-badge">you</span>}
      </td>
      <td className="accounts-table__td">
        <span className="accounts-table__role-badge">
          {account.role.charAt(0).toUpperCase() + account.role.slice(1)}
        </span>
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

import { useState } from 'react';

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString(undefined, { maximumFractionDigits: 0 })} MB`;
}

function parseFilenameDisplay(filename: string): string {
  // mc-backup-YYYY-MM-DD_HH-MM-SS.tar.gz → YYYY-MM-DD HH:MM:SS
  const match = /^mc-backup-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})\.tar\.gz$/.exec(filename);
  if (!match) return filename;
  return `${match[1]} ${match[2]}:${match[3]}:${match[4]}`;
}

export interface BackupRowProps {
  filename: string;
  sizeBytes: number;
  createdAt: number;
  isRestoring: boolean;
  isDeleting: boolean;
  anyBusy: boolean;
  onRestore: (filename: string) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
}

export function BackupRow({
  filename,
  sizeBytes,
  createdAt,
  isRestoring,
  isDeleting,
  anyBusy,
  onRestore,
  onDelete,
}: BackupRowProps) {
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <tr className="accounts-table__row">
      <td className="accounts-table__td">
        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {parseFilenameDisplay(filename)}
        </span>
      </td>
      <td className="accounts-table__td">{formatSize(sizeBytes)}</td>
      <td className="accounts-table__td accounts-table__td--muted">
        {new Date(createdAt).toLocaleString()}
      </td>
      <td className="accounts-table__td accounts-table__td--actions" style={{ whiteSpace: 'nowrap' }}>
        {confirmingRestore ? (
          <span className="accounts-table__confirm">
            <span className="accounts-table__confirm-text" style={{ color: 'var(--yellow)', fontSize: '0.8rem' }}>
              Server must be stopped first. Restore?
            </span>
            <button
              className="btn btn--yellow accounts-table__btn"
              onClick={() => {
                setConfirmingRestore(false);
                void onRestore(filename);
              }}
              disabled={isRestoring || anyBusy}
            >
              {isRestoring ? <span className="control-buttons__spinner-small" /> : 'Yes, restore'}
            </button>
            <button
              className="btn btn--gray accounts-table__btn"
              onClick={() => setConfirmingRestore(false)}
              disabled={isRestoring || anyBusy}
            >
              Cancel
            </button>
          </span>
        ) : confirmingDelete ? (
          <span className="accounts-table__confirm">
            <span className="accounts-table__confirm-text">Delete?</span>
            <button
              className="btn btn--red accounts-table__btn"
              onClick={() => {
                setConfirmingDelete(false);
                void onDelete(filename);
              }}
              disabled={isDeleting || anyBusy}
            >
              {isDeleting ? <span className="control-buttons__spinner-small" /> : 'Yes, delete'}
            </button>
            <button
              className="btn btn--gray accounts-table__btn"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting || anyBusy}
            >
              Cancel
            </button>
          </span>
        ) : (
          <>
            <button
              className="btn btn--yellow accounts-table__btn"
              onClick={() => setConfirmingRestore(true)}
              disabled={anyBusy}
              style={{ marginRight: '0.5rem' }}
            >
              Restore
            </button>
            <button
              className="btn btn--red accounts-table__btn"
              onClick={() => setConfirmingDelete(true)}
              disabled={anyBusy}
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

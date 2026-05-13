import React from 'react';
import { useWorldBackup } from '../hooks/useWorldBackup';
import '../styles/config-panel.css';

interface WorldBackupDownloaderProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorldBackupDownloader: React.FC<WorldBackupDownloaderProps> = ({
  isOpen,
  onClose,
}) => {
  const { status, progress, error, downloadWorldBackup, reset } = useWorldBackup();

  const handleDownload = async () => {
    try {
      await downloadWorldBackup();
    } catch (err) {
      // Error is already captured in the hook state
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = status === 'loading' || status === 'downloading';
  const isComplete = status === 'complete';
  const hasError = status === 'error';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal--medium" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Download World Backup</h2>
          <button
            className="modal__close"
            onClick={handleClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="modal__warning">
          <span className="modal__warning-icon">ℹ</span>
          <span>This will create a compressed archive of your world directory</span>
        </div>

        {error && (
          <div className="modal__error">
            <span className="modal__error-icon">✕</span>
            {error}
          </div>
        )}

        {isComplete && (
          <div className="modal__success">
            <span className="modal__success-icon">✓</span>
            Backup downloaded successfully! Check your downloads folder.
          </div>
        )}

        <div className="modal__content">
          {isLoading ? (
            <div className="backup-progress">
              <div className="backup-progress__message">
                {status === 'loading'
                  ? 'Preparing world backup...'
                  : 'Downloading backup file...'}
              </div>
              <div className="backup-progress__bar">
                <div
                  className="backup-progress__fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="backup-progress__percentage">{progress}%</div>
            </div>
          ) : (
            <div className="backup-info">
              <div className="backup-info__section">
                <h3 className="backup-info__title">What's Included</h3>
                <ul className="backup-info__list">
                  <li>Complete world data</li>
                  <li>Player data</li>
                  <li>Region files</li>
                  <li>Dimension data</li>
                </ul>
              </div>

              <div className="backup-info__section">
                <h3 className="backup-info__title">File Format</h3>
                <p className="backup-info__text">
                  The backup will be downloaded as a compressed .tar.gz file, which is compatible
                  with Windows, macOS, and Linux. You can extract it using any archive manager.
                </p>
              </div>

              <div className="backup-info__section">
                <h3 className="backup-info__title">Storage Note</h3>
                <p className="backup-info__text">
                  The backup file size depends on your world size. Large worlds (1GB+) may take
                  some time to prepare. Consider the file size before downloading.
                </p>
              </div>

              {hasError && (
                <div className="backup-info__error">
                  <p className="backup-info__error-text">
                    If the download doesn't start automatically, check your browser's download settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button
            className="btn btn--gray"
            onClick={handleClose}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Close'}
          </button>
          {status === 'idle' && (
            <button
              className="btn btn--blue"
              onClick={handleDownload}
              disabled={isLoading}
            >
              Start Download
            </button>
          )}
          {isComplete && (
            <button
              className="btn btn--green"
              onClick={handleClose}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

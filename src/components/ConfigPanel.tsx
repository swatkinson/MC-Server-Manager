import React, { useState } from 'react';
import { ServerPropertiesEditor } from './ServerPropertiesEditor';
import { WhitelistManager } from './WhitelistManager';
import { JVMParametersEditor } from './JVMParametersEditor';
import { WorldBackupDownloader } from './WorldBackupDownloader';
import { RestartSchedulerEditor } from './RestartSchedulerEditor';
import { BackupManager } from './BackupManager';
import { WebhooksPanel } from './WebhooksPanel';
import { ServerStatus } from '../types/api';
import '../styles/config-panel.css';

interface ConfigPanelProps {
  className?: string;
  serverStatus?: ServerStatus | null;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ className = '', serverStatus }) => {
  const serverRunning = serverStatus?.status === 'online' || serverStatus?.status === 'starting';
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [jvmOpen, setJvmOpen] = useState(false);
  const [worldBackupOpen, setWorldBackupOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);

  return (
    <>
      <div className={`config-panel ${className}`}>
        <div className="config-panel__buttons">
          <button
            className="config-button config-button--properties"
            onClick={() => setPropertiesOpen(true)}
            title="Edit server.properties configuration"
          >
            <span className="config-button__icon">⚙</span>
            <span className="config-button__text">Server Properties</span>
          </button>

          <button
            className="config-button config-button--jvm"
            onClick={() => setJvmOpen(true)}
            title="View and configure JVM startup parameters"
          >
            <span className="config-button__icon">☕</span>
            <span className="config-button__text">JVM Parameters</span>
          </button>

          <button
            className="config-button config-button--whitelist"
            onClick={() => setWhitelistOpen(true)}
            title="Manage player whitelist"
          >
            <span className="config-button__icon">✓</span>
            <span className="config-button__text">Whitelist</span>
          </button>

          <button
            className="config-button config-button--backup"
            onClick={() => setWorldBackupOpen(true)}
            title="Download world folder as a .tar.gz directly to your browser"
          >
            <span className="config-button__icon">🌍</span>
            <span className="config-button__text">World Backup</span>
          </button>

          <button
            className="config-button config-button--backup"
            onClick={() => setBackupOpen(true)}
            title="Manage scheduled server backups on HDD"
          >
            <span className="config-button__icon">📦</span>
            <span className="config-button__text">Backups</span>
          </button>

          <button
            className="config-button config-button--scheduler"
            onClick={() => setSchedulerOpen(true)}
            title="Configure automatic server restart schedule"
          >
            <span className="config-button__icon">🕐</span>
            <span className="config-button__text">Restart Scheduler</span>
          </button>

          <button
            className="config-button config-button--webhooks"
            onClick={() => setWebhooksOpen(true)}
            title="Configure Discord webhook notifications"
          >
            <span className="config-button__icon">🔔</span>
            <span className="config-button__text">Discord Webhooks</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ServerPropertiesEditor
        isOpen={propertiesOpen}
        onClose={() => setPropertiesOpen(false)}
        serverRunning={serverRunning}
      />
      <WhitelistManager
        isOpen={whitelistOpen}
        onClose={() => setWhitelistOpen(false)}
      />
      <JVMParametersEditor
        isOpen={jvmOpen}
        onClose={() => setJvmOpen(false)}
        serverRunning={serverRunning}
      />
      <WorldBackupDownloader
        isOpen={worldBackupOpen}
        onClose={() => setWorldBackupOpen(false)}
      />
      <BackupManager
        isOpen={backupOpen}
        onClose={() => setBackupOpen(false)}
      />
      <RestartSchedulerEditor
        isOpen={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
      />
      <WebhooksPanel
        isOpen={webhooksOpen}
        onClose={() => setWebhooksOpen(false)}
      />
    </>
  );
};

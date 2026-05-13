import React, { useState } from 'react';
import { ServerPropertiesEditor } from './ServerPropertiesEditor';
import { WhitelistManager } from './WhitelistManager';
import { JVMParametersEditor } from './JVMParametersEditor';
import { WorldBackupDownloader } from './WorldBackupDownloader';
import '../styles/config-panel.css';

interface ConfigPanelProps {
  className?: string;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ className = '' }) => {
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [jvmOpen, setJvmOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

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
            onClick={() => setBackupOpen(true)}
            title="Download world backup"
          >
            <span className="config-button__icon">📦</span>
            <span className="config-button__text">World Backup</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ServerPropertiesEditor
        isOpen={propertiesOpen}
        onClose={() => setPropertiesOpen(false)}
      />
      <WhitelistManager
        isOpen={whitelistOpen}
        onClose={() => setWhitelistOpen(false)}
      />
      <JVMParametersEditor
        isOpen={jvmOpen}
        onClose={() => setJvmOpen(false)}
      />
      <WorldBackupDownloader
        isOpen={backupOpen}
        onClose={() => setBackupOpen(false)}
      />
    </>
  );
};

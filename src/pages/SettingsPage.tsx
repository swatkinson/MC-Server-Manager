import { useState } from 'react';
import { ServerPropertiesEditor } from '../components/ServerPropertiesEditor';
import { JVMParametersEditor } from '../components/JVMParametersEditor';
import { WhitelistManager } from '../components/WhitelistManager';
import { RestartSchedulerEditor } from '../components/RestartSchedulerEditor';
import { WebhooksPanel } from '../components/WebhooksPanel';
import { Icon, IconName } from '../components/icons/Icon';
import { useServerData } from '../context/ServerDataContext';
import '../styles/config-panel.css';

type Panel = 'properties' | 'jvm' | 'whitelist' | 'scheduler' | 'webhooks';

const TILES: Array<{ id: Panel; icon: IconName; title: string; description: string }> = [
  { id: 'properties', icon: 'list', title: 'Server properties', description: 'MOTD, difficulty, view distance, PvP and everything else in server.properties.' },
  { id: 'jvm', icon: 'coffee', title: 'JVM parameters', description: 'Heap size and garbage-collector flags in user_jvm_args.txt. Applies on next restart.' },
  { id: 'whitelist', icon: 'shield', title: 'Whitelist', description: 'Who is allowed to join, and whether the whitelist is enforced.' },
  { id: 'scheduler', icon: 'clock', title: 'Restart schedule', description: 'Daily automatic restart with in-game 5- and 1-minute warnings.' },
  { id: 'webhooks', icon: 'bell', title: 'Discord notifications', description: 'Webhook alerts for start, stop, crashes, restarts and backups.' },
];

export function SettingsPage() {
  const { status } = useServerData();
  const [open, setOpen] = useState<Panel | null>(null);
  const serverRunning = status?.status === 'online' || status?.status === 'starting';
  const close = () => setOpen(null);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h2 className="page__title">Server settings</h2>
          <p className="page__subtitle">Game and launcher configuration. Mod configs live under Mod Configs.</p>
        </div>
      </header>

      <div className="settings-grid">
        {TILES.map((t) => (
          <button key={t.id} className="settings-tile glass" onClick={() => setOpen(t.id)}>
            <span className="settings-tile__icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="settings-tile__title">{t.title}</span>
            <span className="settings-tile__description">{t.description}</span>
          </button>
        ))}
      </div>

      <ServerPropertiesEditor isOpen={open === 'properties'} onClose={close} serverRunning={serverRunning} />
      <JVMParametersEditor isOpen={open === 'jvm'} onClose={close} serverRunning={serverRunning} />
      <WhitelistManager isOpen={open === 'whitelist'} onClose={close} />
      <RestartSchedulerEditor isOpen={open === 'scheduler'} onClose={close} />
      <WebhooksPanel isOpen={open === 'webhooks'} onClose={close} />
    </div>
  );
}

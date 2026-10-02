import { useState } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';
import { ServerDataProvider, useServerData } from '../context/ServerDataContext';
import { ControlButtons } from './ControlButtons';
import { Icon, IconName } from './icons/Icon';
import { formatUptime } from '../utils/formatting';
import type { PublicUser } from '../types/api';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles: Array<PublicUser['role']>;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'overview', roles: ['admin', 'moderator', 'user'] },
  { to: '/configs', label: 'Mod Configs', icon: 'files', roles: ['admin', 'moderator'] },
  { to: '/backups', label: 'Backups', icon: 'archive', roles: ['admin', 'moderator'] },
  { to: '/settings', label: 'Server Settings', icon: 'settings', roles: ['admin', 'moderator'] },
  { to: '/accounts', label: 'Accounts', icon: 'users', roles: ['admin'] },
  { to: '/audit', label: 'Audit Log', icon: 'audit', roles: ['admin'] },
];

export function AppShell() {
  return (
    <ServerDataProvider>
      <ShellLayout />
    </ServerDataProvider>
  );
}

function ShellLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const role = user?.role ?? 'user';

  async function handleLogout() {
    await logout();
    await navigate({ to: '/login' });
  }

  return (
    <div className={`shell ${navOpen ? 'shell--nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img className="sidebar__logo" src="/background.png" alt="" />
          <div>
            <div className="sidebar__title">MC Server Manager</div>
            <div className="sidebar__subtitle">Control panel</div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {NAV.filter((item) => item.roles.includes(role)).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar__link ${pathname === item.to ? 'sidebar__link--active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="sidebar__avatar">{user?.username.slice(0, 1).toUpperCase()}</span>
            <div className="sidebar__user-text">
              <div className="sidebar__username">{user?.username}</div>
              <div className="sidebar__role">{role}</div>
            </div>
            <button className="icon-btn" onClick={() => void handleLogout()} title="Sign out" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <button className="shell__scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />

      <div className="shell__main">
        <TopBar onToggleNav={() => setNavOpen((o) => !o)} canControl={role !== 'user'} />
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ onToggleNav, canControl }: { onToggleNav: () => void; canControl: boolean }) {
  const { status, statusLoading, refetchStatus, metrics } = useServerData();
  const state = status?.status ?? 'offline';
  const tps = metrics?.tps?.tps ?? null;

  return (
    <header className="topbar glass">
      <button className="icon-btn topbar__menu" onClick={onToggleNav} aria-label="Toggle navigation">
        <Icon name="menu" />
      </button>
      <div className="topbar__identity">
        <h1 className="topbar__name">{status?.motd || 'Minecraft Server'}</h1>
        <div className="topbar__meta">
          <span className={`status-pill status-pill--${statusLoading && !status ? 'unknown' : state}`}>
            <span className="status-pill__dot" />
            {statusLoading && !status ? 'Checking…' : state}
          </span>
          {status && <span className="topbar__chip">v{status.version}</span>}
          {status?.status === 'online' && (
            <>
              <span className="topbar__chip">
                <Icon name="clock" size={14} /> {formatUptime(status.uptime)}
              </span>
              {tps !== null && (
                <span className={`topbar__chip ${tps < 18 ? 'topbar__chip--bad' : tps < 19.5 ? 'topbar__chip--warn' : ''}`}>
                  <Icon name="pulse" size={14} /> {tps.toFixed(1)} TPS
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {canControl && (
        <ControlButtons status={status} loading={statusLoading && !status} onStatusChange={() => void refetchStatus()} />
      )}
    </header>
  );
}

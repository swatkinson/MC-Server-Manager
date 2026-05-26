import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    await navigate({ to: '/login' });
  }

  if (!user) return null;

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu__trigger" onClick={() => setOpen((o) => !o)}>
        <span className="user-menu__icon">◈</span>
        {user.username}
      </button>

      {open && (
        <div className="user-menu__dropdown">
          {user.role === 'admin' && (
            <button
              className="user-menu__item"
              onClick={() => {
                setOpen(false);
                void navigate({ to: '/accounts' });
              }}
            >
              Manage Accounts
            </button>
          )}
          <button
            className="user-menu__item user-menu__item--danger"
            onClick={() => void handleLogout()}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PublicUser, SetupCheckResponse, LoginResponse } from '../types/api';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  setupRequired: boolean | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const setupRes = await fetch('/api/auth/setup', { credentials: 'include' });
        const setupData = (await setupRes.json()) as SetupCheckResponse;
        setSetupRequired(setupData.setupRequired);

        if (!setupData.setupRequired) {
          const meRes = await fetch('/api/auth/me', { credentials: 'include' });
          if (meRes.ok) {
            const meData = (await meRes.json()) as { user: PublicUser };
            setUser(meData.user);
          }
        }
      } catch {
        // network error — leave everything null
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Login failed');
    }
    const data = (await res.json()) as LoginResponse;
    setUser(data.user);
    setSetupRequired(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Setup failed');
    }
    const data = (await res.json()) as LoginResponse;
    setUser(data.user);
    setSetupRequired(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, login, logout, setup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

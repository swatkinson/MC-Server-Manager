import { useState, useCallback, useEffect } from 'react';
import type { PublicUser, UsersListResponse } from '../types/api';
import { useToasts } from '../context/ToastContext';

export interface UseAccountsReturn {
  users: PublicUser[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  deleting: Set<string>;
  createUser: (username: string, password: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAccounts(): UseAccountsReturn {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const { push } = useToasts();

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load accounts');
      const data = (await res.json()) as UsersListResponse;
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createUser = useCallback(
    async (username: string, password: string) => {
      setCreating(true);
      try {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        });
        const data = (await res.json()) as { user?: PublicUser; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Failed to create account');
        push({ kind: 'success', title: 'Account created', message: `@${username} can now log in` });
        await refetch();
      } catch (err) {
        push({
          kind: 'error',
          title: 'Failed to create account',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [push, refetch],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      setDeleting((prev) => new Set(prev).add(id));
      try {
        const target = users.find((u) => u.id === id);
        const res = await fetch(`/api/auth/users/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Failed to delete account');
        push({ kind: 'success', title: 'Account deleted', message: target ? `@${target.username} removed` : '' });
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } catch (err) {
        push({
          kind: 'error',
          title: 'Failed to delete account',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setDeleting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [push, users],
  );

  return { users, loading, error, creating, deleting, createUser, deleteUser, refetch };
}

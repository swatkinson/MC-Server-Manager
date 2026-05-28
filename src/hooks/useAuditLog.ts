import { useState, useEffect, useCallback } from 'react';

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string | null;
  username: string | null;
  role: 'admin' | 'moderator' | 'user' | null;
  action: string;
  details: Record<string, unknown>;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
}

export function useAuditLog(
  limit: number,
  page: number
): {
  entries: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEntries() {
      setLoading(true);
      setError(null);
      try {
        const offset = page * limit;
        const res = await fetch(`/api/audit?limit=${limit}&offset=${offset}`, {
          credentials: 'include',
        });

        if (res.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.statusText}`);
        }

        const data = (await res.json()) as AuditLogResponse;

        if (!cancelled) {
          setEntries(data.entries);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchEntries();

    return () => {
      cancelled = true;
    };
  }, [limit, page, tick]);

  return { entries, total, loading, error, refetch };
}

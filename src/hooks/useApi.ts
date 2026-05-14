import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseApiOptions {
  interval?: number;
  manual?: boolean;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(url: string, options?: UseApiOptions): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.manual);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setLoading(true);
      setError(null);
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const json = (await response.json()) as T;
      setData(json);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (options?.manual) return;

    fetchData();

    if (options?.interval) {
      const interval = setInterval(fetchData, options.interval);
      return () => clearInterval(interval);
    }
  }, [fetchData, options?.interval, options?.manual]);

  return { data, loading, error, refetch: fetchData };
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to post: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await globalThis.fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to delete: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

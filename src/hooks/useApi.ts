import { useState, useEffect, useCallback, useRef } from 'react';
import { extractErrorMessage } from '../utils/apiError';

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
      const response = await globalThis.fetch(url, { credentials: 'include' });
      if (response.status === 401) {
        window.dispatchEvent(new Event('auth:unauthorized'));
        return;
      }
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

async function parseJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired');
  }

  const parsed = await parseJsonOrNull(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, `Request failed: ${response.statusText}`));
  }

  return parsed as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await globalThis.fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired');
  }

  const parsed = await parseJsonOrNull(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, `Request failed: ${response.statusText}`));
  }

  return parsed as T;
}

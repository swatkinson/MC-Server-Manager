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

async function parseJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  }
  return fallback;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const parsed = await parseJsonOrNull(response);

  if (!response.ok) {
    throw new Error(extractMessage(parsed, `Request failed: ${response.statusText}`));
  }

  return parsed as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await globalThis.fetch(url, { method: 'DELETE' });
  const parsed = await parseJsonOrNull(response);

  if (!response.ok) {
    throw new Error(extractMessage(parsed, `Request failed: ${response.statusText}`));
  }

  return parsed as T;
}

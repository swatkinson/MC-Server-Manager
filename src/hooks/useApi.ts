import { useState, useEffect, useCallback } from 'react';

export function useApi<T>(
  url: string,
  options?: { interval?: number; manual?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (options?.manual) {
      return;
    }

    fetchData();

    if (options?.interval) {
      const interval = setInterval(fetchData, options.interval);
      return () => clearInterval(interval);
    }
  }, [url, fetchData, options?.interval, options?.manual]);

  return { data, loading, error, refetch: fetchData };
}

export async function apiPost<T>(
  url: string,
  body: any
): Promise<T> {
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to post: ${response.statusText}`);
  }

  return response.json();
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await globalThis.fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to delete: ${response.statusText}`);
  }

  return response.json();
}

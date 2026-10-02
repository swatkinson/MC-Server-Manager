import { useCallback, useState } from 'react';
import type { ModConfigRoot, ModConfigVersion } from '../types/api';
import { useApi } from './useApi';
import { extractErrorMessage } from '../utils/apiError';

export interface OpenFile {
  root: string;
  path: string;
  content: string; // as last loaded/saved from disk
  mtimeMs: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractErrorMessage(body, `Request failed (${res.status})`));
  return body as T;
}

const fileUrl = (base: string, root: string, path: string) =>
  `${base}?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`;

export function useModConfigs() {
  const { data, loading, error, refetch } = useApi<{ roots: ModConfigRoot[] }>('/api/mod-configs');
  const [file, setFile] = useState<OpenFile | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const open = useCallback(async (root: string, path: string): Promise<OpenFile> => {
    setFileLoading(true);
    try {
      const res = await request<{ content: string; mtimeMs: number }>(fileUrl('/api/mod-configs/file', root, path));
      const opened = { root, path, content: res.content, mtimeMs: res.mtimeMs };
      setFile(opened);
      return opened;
    } finally {
      setFileLoading(false);
    }
  }, []);

  const save = useCallback(
    async (content: string): Promise<void> => {
      if (!file) return;
      const res = await request<{ mtimeMs: number }>(fileUrl('/api/mod-configs/file', file.root, file.path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mtimeMs: file.mtimeMs }),
      });
      setFile({ ...file, content, mtimeMs: res.mtimeMs });
    },
    [file],
  );

  const listVersions = useCallback(async (): Promise<ModConfigVersion[]> => {
    if (!file) return [];
    const res = await request<{ versions: ModConfigVersion[] }>(fileUrl('/api/mod-configs/versions', file.root, file.path));
    return res.versions;
  }, [file]);

  const readVersion = useCallback(
    async (id: string): Promise<string> => {
      if (!file) return '';
      const res = await request<{ content: string }>(
        `${fileUrl('/api/mod-configs/versions', file.root, file.path)}&version=${encodeURIComponent(id)}`,
      );
      return res.content;
    },
    [file],
  );

  return { roots: data?.roots ?? [], loading, error, refetch, file, fileLoading, open, save, listVersions, readVersion };
}

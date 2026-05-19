import { useApi } from './useApi';

export function usePublicIp() {
  const { data } = useApi<{ publicIp: string | null }>('/api/server/public-ip');
  return data?.publicIp ?? null;
}

import { useEffect, useState } from 'react';
import type { JvmSample, SystemMetrics } from '../types/api';
import { useApi } from './useApi';

const MAX_SAMPLES = 720;

// Seeds from the backend's rolling history, then appends each live metrics
// push so the graph keeps moving without refetching.
export function useJvmHistory(metrics: SystemMetrics | null): JvmSample[] {
  const { data } = useApi<{ samples: JvmSample[] }>('/api/metrics/jvm-history');
  const [samples, setSamples] = useState<JvmSample[]>([]);

  useEffect(() => {
    if (data) setSamples(data.samples);
  }, [data]);

  useEffect(() => {
    const jvm = metrics?.ram.jvm;
    if (!jvm) return;
    setSamples((prev) => {
      const t = Date.now();
      const last = prev[prev.length - 1];
      // Metrics arrive every ~5 s; skip duplicates from overlapping REST + socket pushes.
      if (last && t - last.t < 2_500) return prev;
      const next = [...prev, { t, heapUsed: jvm.heapUsed, heapLive: jvm.heapLive, heapCommitted: jvm.heapCommitted, gcPausePercent: jvm.gcPausePercent }];
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, [metrics]);

  return samples;
}

import { useEffect, useRef } from 'react';
import { useApi } from './useApi';
import { useToasts } from '../context/ToastContext';

export type PreflightSeverity = 'ok' | 'warn' | 'error';

export interface PreflightCheck {
  id: string;
  label: string;
  severity: PreflightSeverity;
  message: string;
}

export interface PreflightResponse {
  checks: PreflightCheck[];
}

export function usePreflight() {
  return useApi<PreflightResponse>('/api/health/preflight');
}

/**
 * Runs preflight on mount and toasts each non-ok check once. Re-toasting on
 * subsequent renders is suppressed by the toast dedupe key.
 */
export function useStartupChecks() {
  const { data, error } = usePreflight();
  const { push } = useToasts();
  const surfacedRef = useRef(false);

  useEffect(() => {
    if (error) {
      push({
        kind: 'error',
        title: 'Could not run preflight checks',
        message: error,
        dedupeKey: 'preflight-fetch-error',
      });
      return;
    }

    if (!data || surfacedRef.current) return;
    surfacedRef.current = true;

    for (const check of data.checks) {
      if (check.severity === 'ok') continue;
      push({
        kind: check.severity === 'error' ? 'error' : 'warning',
        title: `${check.label}`,
        message: check.message,
        dedupeKey: `preflight-${check.id}`,
        durationMs: check.severity === 'error' ? 0 : 12000,
      });
    }
  }, [data, error, push]);
}

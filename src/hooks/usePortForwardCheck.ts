import { useEffect } from 'react';
import { PortForwardCheckResult } from '../types/api';
import { useServerSocket } from './useServerSocket';
import { useToasts } from '../context/ToastContext';

export function usePortForwardCheck() {
  const { on } = useServerSocket();
  const { push } = useToasts();

  useEffect(() => {
    const unsubscribe = on<PortForwardCheckResult>('portforward:result', (result) => {
      if (result.ok === true) {
        push({
          kind: 'success',
          title: 'Port forwarding looks good',
          message: result.message,
          dedupeKey: 'portforward-ok',
        });
      } else if (result.ok === false) {
        push({
          kind: 'warning',
          title: 'Port forwarding may not be working',
          message: result.message,
          durationMs: 0,
        });
      } else {
        push({
          kind: 'info',
          title: 'Port-forward check inconclusive',
          message: result.message,
        });
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [on, push]);
}

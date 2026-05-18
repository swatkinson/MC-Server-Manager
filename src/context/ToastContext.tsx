import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs: number;
}

export interface PushToastInput {
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
  /**
   * If provided, a toast with the same dedupeKey already in the stack will
   * suppress duplicates instead of stacking.
   */
  dedupeKey?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (input: PushToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  warning: 8000,
  error: 10000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dedupeRef = useRef(new Map<string, string>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    for (const [key, value] of dedupeRef.current.entries()) {
      if (value === id) dedupeRef.current.delete(key);
    }
  }, []);

  const push = useCallback(
    (input: PushToastInput): string => {
      if (input.dedupeKey && dedupeRef.current.has(input.dedupeKey)) {
        return dedupeRef.current.get(input.dedupeKey) as string;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = input.durationMs ?? DEFAULT_DURATIONS[input.kind];
      const toast: Toast = {
        id,
        kind: input.kind,
        title: input.title,
        message: input.message,
        durationMs: duration,
      };

      setToasts((prev) => [...prev, toast]);
      if (input.dedupeKey) dedupeRef.current.set(input.dedupeKey, id);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>');
  return ctx;
}

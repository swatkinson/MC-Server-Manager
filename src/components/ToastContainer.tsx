import { useToasts, Toast, ToastKind } from '../context/ToastContext';

const ICONS: Record<ToastKind, string> = {
  success: '✓',
  info: 'i',
  warning: '!',
  error: '✕',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`toast toast--${toast.kind}`} role="status">
      <span className="toast__icon" aria-hidden="true">
        {ICONS[toast.kind]}
      </span>
      <div className="toast__body">
        <div className="toast__title">{toast.title}</div>
        {toast.message && <div className="toast__message">{toast.message}</div>}
      </div>
      <button
        className="toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

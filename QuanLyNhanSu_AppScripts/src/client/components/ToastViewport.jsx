import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export function ToastViewport({ toasts }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'error'
          ? AlertCircle
          : toast.tone === 'info'
            ? Info
            : CheckCircle2;
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

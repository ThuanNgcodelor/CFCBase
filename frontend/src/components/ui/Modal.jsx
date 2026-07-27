import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div
        className="fixed inset-0 bg-[var(--cfc-navy)]/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <section
        aria-labelledby="cfc-modal-title"
        aria-modal="true"
        className="cfc-safe-bottom relative z-50 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-panel)] sm:rounded-xl"
        role="dialog"
      >
        <div className="flex min-h-16 items-center justify-between border-b border-[var(--cfc-border)] px-5 sm:px-6">
          <h2 id="cfc-modal-title" className="text-lg font-semibold text-[var(--cfc-ink)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--cfc-muted)] transition hover:bg-slate-100 hover:text-[var(--cfc-ink)]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cfc-scrollbar overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}

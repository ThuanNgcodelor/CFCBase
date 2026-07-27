import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function BottomSheet({ isOpen, onClose, title, description, children }) {
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
    <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
      <button
        type="button"
        aria-label="Đóng bảng điều hướng"
        className="absolute inset-0 h-full w-full bg-[var(--cfc-navy)]/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        aria-labelledby="cfc-bottom-sheet-title"
        className="cfc-safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-hidden rounded-t-2xl border-t border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-panel)]"
        role="dialog"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cfc-border)] px-5 py-4">
          <div>
            <h2 id="cfc-bottom-sheet-title" className="text-lg font-semibold text-[var(--cfc-ink)]">{title}</h2>
            {description && <p className="mt-1 text-sm text-[var(--cfc-muted)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--cfc-muted)] hover:bg-slate-100 hover:text-[var(--cfc-ink)]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="cfc-scrollbar max-h-[calc(85dvh-88px)] overflow-y-auto px-4 py-4">
          {children}
        </div>
      </section>
    </div>
  );
}

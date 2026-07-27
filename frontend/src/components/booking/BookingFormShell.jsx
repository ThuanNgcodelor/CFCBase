import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function BookingFormShell({
  title,
  description,
  onBack,
  onSubmit,
  error,
  children,
  summary,
  renderActions,
}) {
  return (
    <div className="min-h-full bg-[var(--cfc-canvas)] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <form onSubmit={onSubmit} className="mx-auto max-w-[1240px]">
        <header className="mb-5 flex items-start gap-3 sm:mb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--cfc-muted)] transition-colors hover:border-[var(--cfc-border)] hover:bg-white hover:text-[var(--cfc-ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cfc-emerald-dark)]">
              Tạo yêu cầu mới
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cfc-ink)] sm:text-[1.75rem]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-[var(--cfc-muted)]">{description}</p>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="cfc-app-surface overflow-hidden">
            <div className="border-b border-[var(--cfc-border)] px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold text-[var(--cfc-ink)]">Thông tin đăng ký</h2>
              <p className="mt-1 text-sm text-[var(--cfc-muted)]">Các trường có dấu * là bắt buộc.</p>
            </div>
            <div className="space-y-5 p-5 sm:p-6">{children}</div>
          </section>

          <aside className="cfc-app-surface overflow-hidden lg:sticky lg:top-5">
            <div className="border-b border-[var(--cfc-border)] px-5 py-4">
              <h2 className="text-base font-bold text-[var(--cfc-ink)]">Tóm tắt yêu cầu</h2>
              <p className="mt-1 text-sm text-[var(--cfc-muted)]">Kiểm tra nhanh trước khi gửi.</p>
            </div>
            <div className="space-y-1 p-5">{summary}</div>
            <div className="hidden border-t border-[var(--cfc-border)] p-4 lg:flex lg:justify-end lg:gap-3">
              {renderActions()}
            </div>
          </aside>
        </div>

        <div className="cfc-safe-bottom sticky bottom-0 z-20 -mx-4 mt-5 flex gap-3 border-t border-[var(--cfc-border)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgb(6_42_61_/_8%)] backdrop-blur lg:hidden">
          {renderActions()}
        </div>
      </form>
    </div>
  );
}

export function BookingSummaryItem({ icon: Icon, label, value, accent = 'emerald' }) {
  const tones = {
    room: 'bg-blue-50 text-[var(--cfc-room)]',
    vehicle: 'bg-teal-50 text-[var(--cfc-vehicle)]',
    emerald: 'bg-emerald-50 text-[var(--cfc-emerald-dark)]',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[accent] || tones.emerald}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--cfc-muted)]">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-5 text-[var(--cfc-ink)]">{value || 'Chưa nhập'}</p>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { statusLabel, statusTone } from '../../utils/hr';

const TONE_CLASSES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
};

export function HrPageShell({ children, size = 'wide', className = '' }) {
  const sizes = {
    wide: 'max-w-[1600px]',
    standard: 'max-w-[1440px]',
    readable: 'max-w-6xl',
  };
  return (
    <div className={`hr-page-shell mx-auto min-w-0 w-full max-w-full ${sizes[size] || sizes.wide} ${className}`}>
      {children}
    </div>
  );
}

export function HrPageHeader({ eyebrow = 'Quản lý nhân sự', title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">{actions}</div>}
    </div>
  );
}

export function HrDrawer({ isOpen, onClose, title, description, children, size = 'standard' }) {
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

  const widthClass = size === 'wide' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-[var(--cfc-navy)]/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Đóng bảng thao tác"
      />
      <section
        className={`cfc-safe-top cfc-safe-bottom absolute inset-y-0 right-0 flex w-full ${widthClass} flex-col border-l border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-panel)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hr-drawer-title"
        aria-describedby={description ? 'hr-drawer-description' : undefined}
      >
        <header className="flex min-h-[76px] shrink-0 items-start justify-between gap-4 border-b border-[var(--cfc-border)] px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <h2 id="hr-drawer-title" className="text-xl font-semibold tracking-tight text-[var(--cfc-ink)]">{title}</h2>
            {description && <p id="hr-drawer-description" className="mt-1.5 text-sm leading-5 text-[var(--cfc-muted)]">{description}</p>}
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--cfc-muted)] transition hover:bg-slate-100 hover:text-[var(--cfc-ink)]"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="cfc-scrollbar min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </section>
    </div>
  );
}

export function HrStatusBadge({ status, label }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex min-w-max items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${TONE_CLASSES[tone]}`}>
      {label || statusLabel(status)}
    </span>
  );
}

export function HrLoading({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 shadow-sm">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function HrError({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Không thể tải dữ liệu</p>
          <p className="mt-1">{message}</p>
          {onRetry && <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onRetry}>Thử lại</Button>}
        </div>
      </div>
    </div>
  );
}

export function HrEmpty({ title = 'Chưa có dữ liệu', description }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 max-w-lg text-sm text-gray-500">{description}</p>}
    </div>
  );
}

function paginationItems(page, totalPages) {
  const indexes = new Set([0, 1, page - 1, page, page + 1, totalPages - 2, totalPages - 1]);
  const pages = [...indexes]
    .filter((value) => value >= 0 && value < totalPages)
    .sort((left, right) => left - right);
  const items = [];

  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) {
      items.push(`gap-${pages[index - 1]}-${value}`);
    }
    items.push(value);
  });

  return items;
}

export function HrPagination({ page, totalPages, totalElements, loading, onPageChange }) {
  if (!totalPages) return null;
  const goToPage = (nextPage) => onPageChange(Math.max(0, Math.min(nextPage, totalPages - 1)));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-gray-500">{totalElements} kết quả · Trang {page + 1}/{totalPages}</span>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" variant="secondary" className="flex-1 sm:flex-none" disabled={loading || page <= 0} onClick={() => goToPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Trước
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {paginationItems(page, totalPages).map((item) => (
            typeof item === 'string' ? (
              <span key={item} className="px-1 text-gray-400" aria-hidden="true">…</span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={loading}
                aria-label={`Đến trang ${item + 1}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => goToPage(item)}
                className={`h-8 min-w-8 rounded-md border px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${item === page
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'}`}
              >
                {item + 1}
              </button>
            )
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" className="flex-1 sm:flex-none" disabled={loading || page + 1 >= totalPages} onClick={() => goToPage(page + 1)}>
          Sau <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function HrReadOnlyNotice({ children }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
      {children}
    </div>
  );
}

import { AlertCircle, ChevronLeft, ChevronRight, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { statusLabel, statusTone } from '../../utils/hr';

const TONE_CLASSES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
};

export function HrPageHeader({ eyebrow = 'Quản lý nhân sự', title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function HrStatusBadge({ status, label }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>
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

export function HrPagination({ page, totalPages, totalElements, loading, onPageChange }) {
  if (!totalPages) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-gray-500">{totalElements} kết quả · Trang {page + 1}/{totalPages}</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={loading || page <= 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Trước
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={loading || page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
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

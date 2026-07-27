import React, { memo } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Truck,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { vi } from 'date-fns/locale/vi';
import { Button } from '../ui/Button';

const CustomToolbar = ({
  date,
  view,
  onNavigate,
  onView,
  resources,
  selectedResource,
  onResourceChange,
  selectedStatus,
  onStatusChange,
  searchValue,
  onSearchChange,
  resourceType,
  loading,
}) => {
  const isCar = resourceType === 'car';
  const ResourceIcon = isCar ? Truck : Building2;

  const goToBack = () => {
    if (view === 'month') onNavigate(subMonths(date, 1));
    else if (view === 'week') onNavigate(subWeeks(date, 1));
    else onNavigate(subDays(date, 1));
  };

  const goToNext = () => {
    if (view === 'month') onNavigate(addMonths(date, 1));
    else if (view === 'week') onNavigate(addWeeks(date, 1));
    else onNavigate(addDays(date, 1));
  };

  const label = () => {
    if (view === 'month') return format(date, 'MM/yyyy', { locale: vi });
    if (view === 'day') return format(date, 'EEEE, dd/MM', { locale: vi });
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')}`;
  };

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-sm)]">
      <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(180px,1fr)_190px_minmax(220px,1.15fr)_auto] xl:items-center">
        <label className="relative min-w-0">
          <span className="sr-only">{isCar ? 'Chọn xe' : 'Chọn phòng họp'}</span>
          <ResourceIcon className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isCar ? 'text-[var(--cfc-vehicle)]' : 'text-[var(--cfc-room)]'}`} />
          <select
            value={selectedResource}
            onChange={(event) => onResourceChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-[var(--cfc-border)] bg-white pl-10 pr-8 text-sm font-medium text-[var(--cfc-ink)] outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Tất cả {isCar ? 'xe' : 'phòng họp'}</option>
            {resources?.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {isCar
                  ? `${resource.vehicleType?.name || 'Xe'} · ${resource.licensePlate}`
                  : `${resource.name}${resource.location ? ` · ${resource.location}` : ''}`}
              </option>
            ))}
          </select>
        </label>

        <label className="relative">
          <span className="sr-only">Lọc trạng thái</span>
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cfc-muted)]" />
          <select
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-[var(--cfc-border)] bg-white pl-10 pr-8 text-sm text-[var(--cfc-ink)] outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PENDING">Chờ duyệt</option>
          </select>
        </label>

        <label className="relative">
          <span className="sr-only">Tìm trong lịch</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cfc-muted)]" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={isCar ? 'Tìm hành trình hoặc người đặt...' : 'Tìm cuộc họp hoặc người đặt...'}
            className="h-11 w-full rounded-lg border border-[var(--cfc-border)] bg-white pl-10 pr-3 text-sm text-[var(--cfc-ink)] outline-none placeholder:text-slate-400 focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <ViewSwitcher view={view} onView={onView} />
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--cfc-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={goToBack} aria-label="Kỳ trước">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => onNavigate(new Date())}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--cfc-border)] bg-white px-3 text-sm font-semibold text-[var(--cfc-ink)] hover:bg-[var(--cfc-surface-muted)] sm:min-w-52 sm:flex-none"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--cfc-emerald-dark)]" />
            <span className="truncate capitalize">{label()}</span>
          </button>
          <Button type="button" variant="secondary" size="icon" onClick={goToNext} aria-label="Kỳ tiếp theo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="hidden sm:inline-flex">
            <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate(new Date())}>
              Hôm nay
            </Button>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-[var(--cfc-muted)]">
          {loading && <span className="font-medium text-[var(--cfc-cobalt)]">Đang đồng bộ lịch...</span>}
          <Legend color={isCar ? 'bg-[var(--cfc-vehicle)]' : 'bg-[var(--cfc-room)]'} label="Đã duyệt" />
          <Legend color="bg-amber-500" label="Chờ duyệt" />
          <Legend color="bg-slate-400" label="Lịch sử" />
        </div>
      </div>
    </section>
  );
};

function ViewSwitcher({ view, onView }) {
  return (
    <div className="grid h-11 grid-cols-3 overflow-hidden rounded-lg border border-[var(--cfc-border)] bg-white">
      {[
        ['day', 'Ngày'],
        ['week', 'Tuần'],
        ['month', 'Tháng'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onView(value)}
          className={`min-w-16 border-r border-[var(--cfc-border)] px-3 text-sm font-semibold last:border-r-0 ${
            view === value
              ? 'bg-emerald-50 text-[var(--cfc-emerald-dark)] shadow-[inset_0_-2px_var(--cfc-emerald)]'
              : 'text-[var(--cfc-muted)] hover:bg-slate-50 hover:text-[var(--cfc-ink)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default memo(CustomToolbar);

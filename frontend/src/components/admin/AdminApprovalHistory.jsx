import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Filter,
  Search,
} from 'lucide-react';
import { approvalApi } from '../../api/approvalApi';
import { formatViDate, formatViDateTime, formatViTime } from '../../utils/dateTime';
import { BookingEmptyState } from '../booking/BookingEmptyState';
import { BookingStatusBadge } from '../booking/BookingStatusBadge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Surface } from '../ui/Surface';

const initialFilters = {
  keyword: '',
  type: 'ALL',
  status: 'ALL',
  from: '',
  to: '',
  direction: 'desc',
};

export default function AdminApprovalHistory() {
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page, size: 20, direction: filters.direction };
        if (filters.keyword) params.keyword = filters.keyword;
        if (filters.type !== 'ALL') params.type = filters.type;
        if (filters.status !== 'ALL') params.status = filters.status;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        const data = await approvalApi.getHistory(params);
        if (active) setResult(data);
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Không tải được lịch sử xử lý.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      active = false;
    };
  }, [filters, page]);

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setFilters({ ...draftFilters, keyword: draftFilters.keyword.trim() });
  };

  const clearFilters = () => {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <Surface as="form" onSubmit={applyFilters} className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_160px_180px_160px_160px]">
          <label className="relative">
            <span className="sr-only">Tìm lịch sử</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cfc-muted)]" />
            <input
              value={draftFilters.keyword}
              onChange={(event) => updateDraft('keyword', event.target.value)}
              placeholder="Tên, email, phòng, xe, người xử lý..."
              className="h-11 w-full rounded-lg border border-[var(--cfc-border)] pl-10 pr-3 text-sm outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select value={draftFilters.type} onChange={(event) => updateDraft('type', event.target.value)} className="h-11 rounded-lg border border-[var(--cfc-border)] px-3 text-sm outline-none focus:border-[var(--cfc-cobalt)]">
            <option value="ALL">Tất cả loại</option>
            <option value="ROOM">Phòng họp</option>
            <option value="CAR">Xe công tác</option>
          </select>
          <select value={draftFilters.status} onChange={(event) => updateDraft('status', event.target.value)} className="h-11 rounded-lg border border-[var(--cfc-border)] px-3 text-sm outline-none focus:border-[var(--cfc-cobalt)]">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Đã từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
          <label>
            <span className="sr-only">Từ ngày xử lý</span>
            <input type="date" aria-label="Từ ngày xử lý" value={draftFilters.from} onChange={(event) => updateDraft('from', event.target.value)} className="h-11 w-full rounded-lg border border-[var(--cfc-border)] px-3 text-sm" />
          </label>
          <label>
            <span className="sr-only">Đến ngày xử lý</span>
            <input type="date" aria-label="Đến ngày xử lý" value={draftFilters.to} onChange={(event) => updateDraft('to', event.target.value)} className="h-11 w-full rounded-lg border border-[var(--cfc-border)] px-3 text-sm" />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select value={draftFilters.direction} onChange={(event) => updateDraft('direction', event.target.value)} className="h-10 rounded-lg border border-[var(--cfc-border)] px-3 text-sm">
            <option value="desc">Xử lý mới nhất</option>
            <option value="asc">Xử lý cũ nhất</option>
          </select>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="ghost" onClick={clearFilters}>Xóa lọc</Button>
            <Button type="submit"><Filter className="h-4 w-4" />Áp dụng</Button>
          </div>
        </div>
      </Surface>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Surface className="overflow-hidden">
        <HistoryDesktop loading={loading} rows={result.content} onOpen={(id) => navigate(`/admin/approvals/${id}`)} />
        <HistoryMobile loading={loading} rows={result.content} onOpen={(id) => navigate(`/admin/approvals/${id}`)} />
        {!loading && result.content.length === 0 && (
          <BookingEmptyState icon={ClipboardCheck} title="Không có lịch sử phù hợp" description="Hãy thử thay đổi bộ lọc hoặc khoảng ngày xử lý." />
        )}
      </Surface>

      {result.totalPages > 0 && (
        <Surface className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-[var(--cfc-muted)]">{result.totalElements} kết quả · Trang {page + 1}/{result.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft className="h-4 w-4" />Trước
            </Button>
            <Button size="sm" variant="secondary" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Sau<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Surface>
      )}
    </div>
  );
}

function HistoryDesktop({ loading, rows, onOpen }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full">
        <thead className="bg-[var(--cfc-surface-muted)] text-left">
          <tr className="cfc-data-label">
            <th className="px-5 py-3">Người đặt</th>
            <th className="px-5 py-3">Tài nguyên</th>
            <th className="px-5 py-3">Thời gian</th>
            <th className="px-5 py-3">Trạng thái</th>
            <th className="px-5 py-3">Người xử lý</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--cfc-border)]">
          {loading && <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-[var(--cfc-muted)]">Đang tải lịch sử...</td></tr>}
          {!loading && rows.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-slate-50">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src={item.requester?.avatarUrl} name={item.requester?.fullName} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-[var(--cfc-ink)]">{item.requester?.fullName}</p>
                    <p className="mt-1 text-xs text-[var(--cfc-muted)]">{item.requester?.departmentName || item.requester?.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--cfc-ink)]">
                  {item.type === 'ROOM' ? <Building2 className="h-4 w-4 text-[var(--cfc-room)]" /> : <Car className="h-4 w-4 text-[var(--cfc-vehicle)]" />}
                  {item.resourceName}
                </div>
                <p className="mt-1 max-w-60 truncate text-xs text-[var(--cfc-muted)]">{item.purpose}</p>
              </td>
              <td className="whitespace-nowrap px-5 py-4">
                <p className="text-sm font-medium text-[var(--cfc-ink)]">{formatViDate(item.startTime)}</p>
                <p className="mt-1 text-xs text-[var(--cfc-muted)]">{formatViTime(item.startTime)} · xử lý {formatViDateTime(item.actedAt)}</p>
              </td>
              <td className="px-5 py-4">
                <BookingStatusBadge status={item.status} />
                {item.reason && <p className="mt-1 max-w-44 truncate text-xs text-[var(--cfc-muted)]" title={item.reason}>{item.reason}</p>}
              </td>
              <td className="px-5 py-4 text-sm text-[var(--cfc-ink)]">{item.approver?.fullName || 'Không rõ'}</td>
              <td className="px-5 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => onOpen(item.bookingId)}>Chi tiết</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryMobile({ loading, rows, onOpen }) {
  if (loading || rows.length === 0) return null;
  return (
    <div className="divide-y divide-[var(--cfc-border)] md:hidden">
      {rows.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.bookingId)} className="w-full px-4 py-4 text-left hover:bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={item.requester?.avatarUrl} name={item.requester?.fullName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--cfc-ink)]">{item.requester?.fullName}</p>
                <p className="truncate text-xs text-[var(--cfc-muted)]">{item.requester?.departmentName || item.requester?.email}</p>
              </div>
            </div>
            <BookingStatusBadge status={item.status} />
          </div>
          <div className="mt-3 rounded-lg bg-[var(--cfc-surface-muted)] p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--cfc-ink)]">
              {item.type === 'ROOM' ? <Building2 className="h-4 w-4 text-[var(--cfc-room)]" /> : <Car className="h-4 w-4 text-[var(--cfc-vehicle)]" />}
              {item.resourceName}
            </p>
            <p className="mt-1 text-xs text-[var(--cfc-muted)]">{item.purpose}</p>
          </div>
          <p className="mt-3 text-xs text-[var(--cfc-muted)]">{formatViDateTime(item.startTime)} · xử lý bởi {item.approver?.fullName || 'Không rõ'}</p>
          {item.reason && <p className="mt-2 text-xs text-[var(--cfc-ink)]">Lý do: {item.reason}</p>}
        </button>
      ))}
    </div>
  );
}

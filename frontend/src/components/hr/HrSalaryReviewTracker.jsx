import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, CheckCircle2, Filter, Search } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { hrSalaryRaiseApi } from '../../api/hrSalaryRaiseApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDate } from '../../utils/hr';
import { Button } from '../ui/Button';
import { HrDrawer, HrEmpty, HrError, HrLoading, HrPagination, HrStatusBadge } from './HrUi';

const BUCKETS = [
  { key: 'ALL', label: 'Tất cả', stat: 'totalEmployees', tone: 'bg-slate-50 text-slate-800' },
  { key: 'OVERDUE', label: 'Quá hạn', stat: 'overdue', tone: 'bg-red-50 text-red-800' },
  { key: 'DUE_30', label: 'Trong 30 ngày', stat: 'due30', tone: 'bg-amber-50 text-amber-800' },
  { key: 'DUE_60', label: '31–60 ngày', stat: 'due60', tone: 'bg-blue-50 text-blue-800' },
  { key: 'DUE_90', label: '61–90 ngày', stat: 'due90', tone: 'bg-indigo-50 text-indigo-800' },
  { key: 'LATER', label: 'Sau 90 ngày', stat: 'later', tone: 'bg-emerald-50 text-emerald-800' },
  { key: 'MISSING', label: 'Thiếu ngày hạn', stat: 'missing', tone: 'bg-orange-50 text-orange-800' },
  { key: 'RESOLVED', label: 'Đã kết thúc', stat: 'resolved', tone: 'bg-gray-100 text-gray-700' },
];

const REVIEW_STATUS = [
  ['PENDING', 'Chờ rà soát'],
  ['IN_REVIEW', 'Đang rà soát'],
  ['APPROVED', 'Đã duyệt nâng'],
  ['DEFERRED', 'Hoãn rà soát'],
  ['NOT_ELIGIBLE', 'Chưa đủ điều kiện'],
  ['COMPLETED', 'Đã hoàn tất'],
];

const STATUS_LABELS = Object.fromEntries(REVIEW_STATUS);

function money(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('vi-VN');
}

function dueLabel(days) {
  if (days === null || days === undefined) return 'Chưa có ngày hạn';
  if (days < 0) return `Quá ${Math.abs(days)} ngày`;
  if (days === 0) return 'Đến hạn hôm nay';
  return `Còn ${days} ngày`;
}

function ReviewDrawer({ employee, busy, onClose, onSave }) {
  const [form, setForm] = useState({ status: 'PENDING', followUpDate: '', note: '' });

  useEffect(() => {
    if (!employee) return;
    setForm({
      status: employee.reviewStatus || 'PENDING',
      followUpDate: employee.followUpDate || '',
      note: employee.note || '',
    });
  }, [employee]);

  const submit = (event) => {
    event.preventDefault();
    onSave({
      status: form.status,
      followUpDate: form.status === 'DEFERRED' ? form.followUpDate || null : null,
      note: form.note.trim() || null,
      rowVersion: employee.rowVersion,
    });
  };

  return <HrDrawer
    isOpen={Boolean(employee)}
    onClose={onClose}
    title={employee ? `${employee.employeeCode} · ${employee.fullName}` : 'Rà soát nâng lương'}
    description={employee ? `Tới hạn ${formatHrDate(employee.nextSalaryReviewDate)}. Thay đổi này không tự cập nhật mức lương.` : undefined}
  >
    {employee && <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Kết quả rà soát</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">{REVIEW_STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {form.status === 'DEFERRED' && <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Ngày rà soát lại</span><input required type="date" value={form.followUpDate} onChange={(event) => setForm((current) => ({ ...current, followUpDate: event.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label>}
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Ghi chú {['DEFERRED', 'NOT_ELIGIBLE', 'COMPLETED'].includes(form.status) ? '(bắt buộc)' : ''}</span><textarea required={['DEFERRED', 'NOT_ELIGIBLE', 'COMPLETED'].includes(form.status)} rows={5} maxLength={1000} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Kết quả, lý do hoặc căn cứ rà soát" className="w-full rounded-lg border border-gray-300 p-3 text-sm" /></label>
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Nếu duyệt nâng, hãy cập nhật trạng thái “Đã duyệt nâng”, sau đó dùng tab Import nâng lương để áp dụng mức mới và tạo lịch sử.</div>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy}><CheckCircle2 className="h-4 w-4" />{busy ? 'Đang lưu...' : 'Lưu rà soát'}</Button></div>
    </form>}
  </HrDrawer>;
}

export function HrSalaryReviewTracker() {
  const canApprove = ['ADMIN', 'MANAGER'].includes(authApi.getRole());
  const [bucket, setBucket] = useState('ALL');
  const [filters, setFilters] = useState({ keyword: '', departmentId: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const load = useCallback((signal) => {
    setLoading(true);
    setError('');
    return hrSalaryRaiseApi.reviews({ bucket, ...appliedFilters, page, size: 20 }, { signal })
      .then(setData)
      .catch((requestError) => {
        if (!signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh sách tới hạn nâng lương.'));
      })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, [appliedFilters, bucket, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);

  useEffect(() => {
    const controller = new AbortController();
    hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal })
      .then(setDepartments)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const employees = normalizePage(data?.employees);
  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setAppliedFilters({ keyword: filters.keyword.trim(), departmentId: filters.departmentId });
  };
  const chooseBucket = (value) => { setBucket(value); setPage(0); };
  const save = async (payload) => {
    setBusy(true);
    try {
      await hrSalaryRaiseApi.updateReview(selected.employeeId, payload);
      toast.success('Đã cập nhật trạng thái rà soát.');
      setSelected(null);
      setRevision((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể cập nhật trạng thái rà soát.'));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><CalendarClock className="h-5 w-5" /></span><div><h2 className="font-semibold text-gray-900">Theo dõi tới hạn nâng lương</h2><p className="mt-1 text-sm text-gray-500">Ngày tới hạn chỉ tạo việc cần rà soát; hệ thống không tự nâng lương.</p></div></div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{BUCKETS.map((item) => <button type="button" key={item.key} onClick={() => chooseBucket(item.key)} className={`rounded-lg border p-3 text-left transition ${bucket === item.key ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent'} ${item.tone}`}><p className="text-xs font-medium">{item.label}</p><p className="mt-1 text-xl font-semibold">{data?.stats?.[item.stat] || 0}</p></button>)}</div>

      <form onSubmit={applyFilters} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_280px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tìm MS hoặc họ tên" className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm" /></label>
        <select value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả phòng ban</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Button type="submit" size="sm"><Filter className="h-4 w-4" />Áp dụng</Button>
      </form>

      {error && <div className="mt-4"><HrError message={error} onRetry={() => setRevision((value) => value + 1)} /></div>}
      {loading ? <div className="mt-4"><HrLoading /></div> : <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200"><table className="min-w-[1120px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3">Phòng ban / chức vụ</th><th className="px-4 py-3">Mức hiện tại</th><th className="px-4 py-3">Lần nâng gần nhất</th><th className="px-4 py-3">Ngày cần rà soát</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{employees.content.map((item) => <tr key={item.employeeId} className={item.daysUntilDue < 0 && !['COMPLETED', 'NOT_ELIGIBLE'].includes(item.reviewStatus) ? 'bg-red-50/40' : ''}><td className="px-4 py-3"><Link to={`/manager/hr/employees/${item.employeeId}`} className="font-semibold text-blue-700 hover:underline">{item.employeeCode}</Link><p className="text-xs text-gray-500">{item.fullName}</p></td><td className="px-4 py-3">{item.departmentName || '—'}<p className="text-xs text-gray-500">{item.positionName || '—'}</p></td><td className="px-4 py-3">{money(item.baseSalary)} + {money(item.allowance)}<p className="text-xs text-gray-500">Bậc {item.salaryGrade || '—'} · {item.salaryScaleCode || '—'}</p></td><td className="px-4 py-3">{formatHrDate(item.lastSalaryRaiseDate)}<p className="text-xs text-gray-500">Chu kỳ {item.reviewCycleMonths || '—'} tháng</p></td><td className="px-4 py-3"><b>{formatHrDate(item.effectiveReviewDate)}</b><p className={`text-xs ${item.daysUntilDue < 0 ? 'text-red-700' : 'text-gray-500'}`}>{dueLabel(item.daysUntilDue)}</p>{item.followUpDate && <p className="text-xs text-amber-700">Hạn gốc {formatHrDate(item.nextSalaryReviewDate)}</p>}</td><td className="px-4 py-3"><HrStatusBadge status={item.reviewStatus} label={STATUS_LABELS[item.reviewStatus]} />{item.note && <p className="mt-1 max-w-[240px] truncate text-xs text-gray-500" title={item.note}>{item.note}</p>}</td><td className="px-4 py-3 text-right">{canApprove ? <Button type="button" size="sm" variant="secondary" disabled={!item.nextSalaryReviewDate} onClick={() => setSelected(item)}>Rà soát</Button> : '—'}</td></tr>)}</tbody></table>{!employees.content.length && <div className="p-5"><HrEmpty title="Không có nhân viên trong nhóm này" /></div>}</div>}
      {!loading && <div className="mt-3"><HrPagination page={employees.page} totalPages={employees.totalPages} totalElements={employees.totalElements} loading={loading} onPageChange={setPage} /></div>}
    </section>
    <ReviewDrawer employee={selected} busy={busy} onClose={() => !busy && setSelected(null)} onSave={save} />
  </>;
}

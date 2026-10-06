import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, CheckCircle2, FileSearch, RotateCcw, Trash2, Upload } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { hrSalaryRaiseApi } from '../../api/hrSalaryRaiseApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDate, formatHrDateTime } from '../../utils/hr';
import { Button } from '../ui/Button';
import { HrEmpty, HrError, HrPagination, HrStatusBadge } from './HrUi';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function money(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('vi-VN');
}

function reviewCycle(value) {
  const months = Number(value);
  if (!Number.isFinite(months) || months <= 0) return '—';
  if (months % 12 === 0) return `${months / 12} năm (${months} tháng)`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return years > 0 ? `${years} năm ${remaining} tháng (${months} tháng)` : `${months} tháng`;
}

function salaryDelta(current, next) {
  const oldValue = Number(current);
  const newValue = Number(next);
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) return '—';
  const delta = newValue - oldValue;
  const percent = oldValue === 0 ? null : (delta / oldValue) * 100;
  return `+${money(delta)}${percent === null ? '' : ` (${percent.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`}`;
}

function Stat({ label, value, tone = 'gray' }) {
  const color = { gray: 'bg-gray-50', green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', red: 'bg-red-50 text-red-800', blue: 'bg-blue-50 text-blue-800' }[tone];
  return <div className={`rounded-lg p-3 ${color}`}><p className="text-xs opacity-70">{label}</p><p className="mt-1 text-xl font-semibold">{value || 0}</p></div>;
}

export function HrSalaryRaiseImport() {
  const canApprove = ['ADMIN', 'MANAGER'].includes(authApi.getRole());
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState(normalizePage(null));
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');

  const load = useCallback((signal) => {
    setError('');
    return hrSalaryRaiseApi.imports({}, { signal }).then((value) => {
      const normalized = normalizePage(value);
      setBatches(normalized);
      if (!selectedId && normalized.content.length) setSelectedId(normalized.content[0].id);
    }).catch((requestError) => {
      if (!signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải lịch sử nâng lương.'));
    });
  }, [selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);

  useEffect(() => {
    if (!selectedId) { setPreview(null); return undefined; }
    const controller = new AbortController();
    hrSalaryRaiseApi.preview(selectedId, page, { signal: controller.signal })
      .then(setPreview)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải preview nâng lương.'));
      });
    return () => controller.abort();
  }, [selectedId, page, revision]);

  const batch = preview?.batch || batches.content.find((item) => item.id === selectedId);
  const rows = preview?.rows || [];

  const chooseFile = (event) => {
    const value = event.target.files?.[0];
    if (!value) return;
    if (!value.name.toLowerCase().endsWith('.xlsx') || value.size > MAX_FILE_SIZE) {
      toast.error('Chỉ nhận file .xlsx tối đa 10 MB.');
      event.target.value = '';
      return;
    }
    setFile(value);
  };

  const run = async (name, action, success) => {
    setBusy(name);
    setError('');
    try {
      const result = await action();
      if (result?.id) setSelectedId(result.id);
      toast.success(success);
      setRevision((value) => value + 1);
      return result;
    } catch (requestError) {
      const message = apiErrorMessage(requestError, 'Không thể thực hiện thao tác nâng lương.');
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const upload = async () => {
    if (!file) return;
    const result = await run('upload', () => hrSalaryRaiseApi.upload(file), 'Đã đọc file; chưa thay đổi lương.');
    if (result) {
      setFile(null);
      setPage(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const confirm = () => {
    if ((batch?.warningRows || 0) > 0 && !acceptWarnings) {
      toast.error('Bạn phải xác nhận đã đọc cảnh báo.');
      return;
    }
    const key = crypto.randomUUID?.() || `salary-${Date.now()}`;
    run('confirm', () => hrSalaryRaiseApi.confirm(selectedId, key, acceptWarnings), 'Đã xác nhận nâng lương.');
  };

  const rollback = () => {
    if (!rollbackReason.trim()) { toast.error('Nhập lý do rollback.'); return; }
    run('rollback', () => hrSalaryRaiseApi.rollback(selectedId, rollbackReason.trim()), 'Đã rollback batch nâng lương.')
      .then((result) => { if (result) setRollbackReason(''); });
  };

  const deleteImport = async () => {
    if (!batch || !canApprove) return;
    const confirmed = batch.status === 'CONFIRMED';
    if (confirmed) {
      toast.error('Batch đã áp dụng lương. Hãy rollback trước khi xóa file import.');
      return;
    }
    const confirmedByUser = window.confirm(
      `Xóa file import “${batch.sourceFileName}”?\n\nDữ liệu preview sẽ bị xóa. Lịch sử nâng lương đã rollback vẫn được giữ lại.`,
    );
    if (!confirmedByUser) return;
    setBusy('delete');
    setError('');
    try {
      await hrSalaryRaiseApi.deleteImport(selectedId);
      setBatches((current) => ({
        ...current,
        content: current.content.filter((item) => item.id !== selectedId),
        totalElements: Math.max(0, Number(current.totalElements || 0) - 1),
      }));
      setSelectedId('');
      setPreview(null);
      setPage(0);
      toast.success('Đã xóa file import; dữ liệu lương và lịch sử được giữ an toàn.');
      setRevision((value) => value + 1);
    } catch (requestError) {
      const message = apiErrorMessage(requestError, 'Không thể xóa file import nâng lương.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy('');
    }
  };

  const canDeleteBatch = batch && ['UPLOADED', 'PARSED', 'VALIDATED', 'FAILED', 'ROLLED_BACK'].includes(batch.status);

  return <section className="mb-5 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-gray-900">Import nâng lương</h2></div>
        <p className="mt-1 text-sm text-gray-500">Ghép theo MS, giữ lịch sử lương theo ngày hiệu lực và chặn toàn batch nếu dữ liệu cũ lệch DB.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input ref={inputRef} type="file" accept=".xlsx" onChange={chooseFile} className="max-w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-800" />
        <Button type="button" disabled={!file || Boolean(busy)} onClick={upload}><Upload className="mr-1.5 h-4 w-4" />{busy === 'upload' ? 'Đang đọc...' : 'Tải file nâng lương'}</Button>
      </div>
    </div>

    {error && <div className="mt-4"><HrError message={error} /></div>}

    <div className="mt-5 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Lịch sử batch</p>
        {batches.content.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setPage(0); setAcceptWarnings(false); }} className={`w-full rounded-lg border p-3 text-left ${item.id === selectedId ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{item.sourceFileName}</span><HrStatusBadge status={item.status} /></div>
          <p className="mt-1 text-xs text-gray-500">{item.totalRows} dòng · {formatHrDateTime(item.createdAt)}</p>
        </button>)}
        {!batches.content.length && <HrEmpty title="Chưa có batch nâng lương" />}
      </aside>

      <div className="min-w-0">
        {batch ? <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-medium text-gray-900">{batch.sourceFileName}</p><p className="text-xs text-gray-500">{batch.id}</p></div>
            <div className="flex flex-wrap gap-2">
              {batch.status === 'PARSED' && <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => run('validate', () => hrSalaryRaiseApi.validate(selectedId), 'Đã đối chiếu file với DB.')}><FileSearch className="mr-1.5 h-4 w-4" />{busy === 'validate' ? 'Đang kiểm tra...' : 'Kiểm tra DB'}</Button>}
              {batch.status === 'VALIDATED' && canApprove && <Button type="button" disabled={Boolean(busy) || batch.invalidRows > 0} onClick={confirm}><CheckCircle2 className="mr-1.5 h-4 w-4" />{busy === 'confirm' ? 'Đang áp dụng...' : 'Xác nhận nâng lương'}</Button>}
              {canDeleteBatch && canApprove && <Button type="button" variant="danger" disabled={Boolean(busy)} onClick={deleteImport}><Trash2 className="mr-1.5 h-4 w-4" />{busy === 'delete' ? 'Đang xóa...' : 'Xóa file import'}</Button>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Stat label="Tổng" value={batch.totalRows} /><Stat label="Hợp lệ" value={batch.validRows} tone="green" /><Stat label="Cảnh báo" value={batch.warningRows} tone="amber" /><Stat label="Bị chặn" value={batch.invalidRows} tone="red" /><Stat label="Đã nhập" value={batch.importedRows} tone="blue" /></div>
          {batch.status === 'VALIDATED' && batch.warningRows > 0 && <label className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><input type="checkbox" checked={acceptWarnings} onChange={(event) => setAcceptWarnings(event.target.checked)} /><span>Tôi đã đọc cảnh báo, bao gồm chênh lệch ngày tới hạn so với phép cộng tháng lịch.</span></label>}
          {batch.status === 'VALIDATED' && !canApprove && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Batch đã kiểm tra. Chỉ ADMIN hoặc MANAGER được xác nhận nâng lương.</p>}

          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-3">MS / Họ tên</th><th className="px-3 py-3">Lương hiện tại</th><th className="px-3 py-3">Sau nâng</th><th className="px-3 py-3">Bậc</th><th className="px-3 py-3">Hiệu lực / tới hạn</th><th className="px-3 py-3">Kết quả</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row.sourceRowNumber} className={row.status === 'INVALID' ? 'bg-red-50/50' : ''}>
                <td className="px-3 py-3"><b>{row.data?.employeeCode}</b><p className="text-xs text-gray-500">{row.data?.fullName}</p></td>
                <td className="px-3 py-3">{money(row.data?.currentBaseSalary)} + {money(row.data?.currentAllowance)}<p className="text-xs text-gray-500">DB: {money(row.data?.databaseBaseSalary)} + {money(row.data?.databaseAllowance)}</p></td>
                <td className="px-3 py-3 font-semibold text-emerald-700">{money(row.data?.newBaseSalary)} + {money(row.data?.newAllowance)}<p className="text-xs">Tổng {money(row.data?.newTotal)}</p><p className="text-xs">Tăng lương cơ bản {salaryDelta(row.data?.currentBaseSalary, row.data?.newBaseSalary)}</p></td>
                <td className="px-3 py-3">{row.data?.currentGrade || '—'} → <b>{row.data?.newGrade || '—'}</b><p className="text-xs text-gray-500">{row.data?.salaryScaleCode || '—'}</p></td>
                <td className="px-3 py-3">{formatHrDate(row.data?.effectiveDate)}<p className="text-xs text-gray-500">Chu kỳ {reviewCycle(row.data?.reviewCycleMonths)}</p><p className="text-xs text-gray-500">Tới hạn {formatHrDate(row.data?.nextReviewDate)}</p></td>
                <td className="px-3 py-3"><HrStatusBadge status={row.status} />{row.issues?.length > 0 && <ul className="mt-2 max-w-sm space-y-1 text-xs">{row.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'}>{issue.message}</li>)}</ul>}</td>
              </tr>)}</tbody></table>
          </div>
          <HrPagination page={preview?.page || 0} totalPages={preview?.totalPages || 0} totalElements={preview?.totalElements || 0} onPageChange={setPage} />

          {batch.status === 'CONFIRMED' && canApprove && <div className="mt-4 rounded-lg border border-red-200 p-3"><p className="text-sm font-medium text-red-800">Rollback nâng lương</p><p className="mt-1 text-xs text-red-700">Nhập lý do để hoàn tác lương. Sau khi rollback thành công, bạn có thể xóa file import mà vẫn giữ lịch sử hoàn tác.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} placeholder="Lý do bắt buộc" className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm" /><Button type="button" variant="danger" disabled={Boolean(busy) || !rollbackReason.trim()} onClick={rollback}><RotateCcw className="mr-1.5 h-4 w-4" />Rollback</Button></div></div>}
        </> : <HrEmpty title="Chọn hoặc tải một batch nâng lương" />}
      </div>
    </div>
  </section>;
}

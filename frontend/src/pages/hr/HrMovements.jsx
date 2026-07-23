import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2, Plus, Search, Trash2, UserPlus, X, XCircle } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, formatHrDateTime, movementLabel, nonEmpty } from '../../utils/hr';

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `movement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const initialForm = () => ({
  movementType: 'INCREASE',
  effectiveDate: new Date().toISOString().slice(0, 10),
  reason: '',
  decisionNumber: '',
  decisionDate: '',
  idempotencyKey: newIdempotencyKey(),
});

function MovementRoute({ item }) {
  const from = item.fromDepartmentName || item.fromDepartment?.name || item.fromDepartment
    || item.fromPositionName || item.fromPosition?.name || item.fromPosition
    || employmentStatusLabel(item.fromEmployeeStatus);
  const to = item.toDepartmentName || item.toDepartment?.name || item.toDepartment
    || item.toPositionName || item.toPosition?.name || item.toPosition
    || employmentStatusLabel(item.toEmployeeStatus);
  return <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500"><span>{nonEmpty(from)}</span><ArrowRight className="h-3.5 w-3.5" /><span className="font-medium text-gray-700">{nonEmpty(to)}</span></div>;
}

export default function HrMovements() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [employeeKeyword, setEmployeeKeyword] = useState('');
  const [employeeResults, setEmployeeResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searching, setSearching] = useState(false);
  const [employeeSearchDone, setEmployeeSearchDone] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getMovements({ page, size: 20 }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải lịch sử tăng/giảm.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadKey]);

  const resetForm = () => {
    setForm(initialForm());
    setEmployeeKeyword('');
    setEmployeeResults([]);
    setSelectedEmployee(null);
    setEmployeeSearchDone(false);
  };

  const changeMovementType = (movementType) => {
    setForm((current) => ({ ...current, movementType, idempotencyKey: newIdempotencyKey() }));
    setSelectedEmployee(null);
    setEmployeeResults([]);
    setEmployeeSearchDone(false);
  };

  const searchEmployees = async (event) => {
    event.preventDefault();
    setSearching(true);
    setEmployeeSearchDone(false);
    try {
      const data = await hrEmployeeApi.getEmployees({
        page: 0,
        size: 20,
        keyword: employeeKeyword.trim() || undefined,
        status: form.movementType === 'INCREASE' ? 'DRAFT' : 'ACTIVE',
        sort: 'employeeCode,asc',
      });
      setEmployeeResults(normalizePage(data).content);
      setEmployeeSearchDone(true);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tìm nhân sự.'));
    } finally {
      setSearching(false);
    }
  };

  const createMovement = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) {
      toast.error('Vui lòng chọn một hồ sơ nhân sự.');
      return;
    }
    if (form.movementType === 'DECREASE' && !form.reason.trim()) {
      toast.error('Vui lòng nhập lý do giảm nhân sự.');
      return;
    }
    setBusy('create');
    try {
      await hrActivityApi.createMovement({
        employeeId: selectedEmployee.id,
        movementType: form.movementType,
        effectiveDate: form.effectiveDate,
        reason: form.reason.trim() || null,
        decisionNumber: form.decisionNumber.trim() || null,
        decisionDate: form.decisionDate || null,
        idempotencyKey: form.idempotencyKey,
      });
      toast.success('Đã tạo biến động nháp. Hãy kiểm tra rồi xác nhận.');
      setShowForm(false);
      resetForm();
      setPage(0);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tạo biến động nhân sự.'));
    } finally {
      setBusy('');
    }
  };

  const runMovementAction = async (item, action) => {
    const messages = {
      confirm: `Xác nhận ${movementLabel(item.movementType)} cho ${item.employeeName}?`,
      cancel: 'Hủy biến động nháp này?',
      delete: 'Xóa vĩnh viễn biến động nháp này?',
    };
    if (!window.confirm(messages[action])) return;
    setBusy(`${action}-${item.id}`);
    try {
      if (action === 'confirm') await hrActivityApi.confirmMovement(item.id, item.rowVersion);
      if (action === 'cancel') await hrActivityApi.cancelMovement(item.id, item.rowVersion);
      if (action === 'delete') await hrActivityApi.deleteMovement(item.id, item.rowVersion);
      toast.success(action === 'confirm' ? 'Đã xác nhận biến động' : action === 'cancel' ? 'Đã hủy biến động' : 'Đã xóa biến động nháp');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xử lý biến động.'));
    } finally {
      setBusy('');
    }
  };

  const ActionButtons = ({ item }) => item.status === 'DRAFT' ? (
    <div className="flex flex-wrap gap-1.5">
      <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'confirm')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Xác nhận</Button>
      <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'cancel')}><XCircle className="mr-1 h-3.5 w-3.5" />Hủy</Button>
      <Button type="button" size="sm" variant="danger" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'delete')} aria-label="Xóa biến động nháp"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  ) : null;

  return (
    <div className="w-full">
      <SEOHead title="CFC Base | Tăng giảm nhân sự" url="https://cfcbooking.io.vn/manager/hr/movements" />
      <HrPageHeader
        title="Tăng / Giảm nhân sự"
        description="Tạo biến động nháp, kiểm tra và xác nhận trước khi áp dụng vào hồ sơ và danh sách tháng kế tiếp."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/employees/new')}><UserPlus className="mr-1.5 h-4 w-4" />Tạo hồ sơ nháp</Button>
            <Button type="button" onClick={() => { setShowForm((value) => !value); if (showForm) resetForm(); }}><Plus className="mr-1.5 h-4 w-4" />Tạo Tăng/Giảm</Button>
          </>
        )}
      />

      {showForm && (
        <form onSubmit={createMovement} className="mb-5 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-gray-900">Biến động nhân sự mới</h2><p className="mt-1 text-sm text-gray-500">Tăng dùng hồ sơ nháp; Giảm dùng hồ sơ đang làm việc.</p></div><button type="button" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" onClick={() => { setShowForm(false); resetForm(); }}><X className="h-5 w-5" /></button></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Loại biến động<select value={form.movementType} onChange={(event) => changeMovementType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal"><option value="INCREASE">Tăng nhân sự</option><option value="DECREASE">Giảm nhân sự</option></select></label>
            <label className="text-sm font-medium text-gray-700">Ngày hiệu lực<input type="date" required value={form.effectiveDate} onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" /></label>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="text-sm font-medium text-gray-700">Tìm theo mã hoặc họ tên</label>
            <div className="mt-1.5 flex gap-2"><input value={employeeKeyword} onChange={(event) => setEmployeeKeyword(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5" placeholder={form.movementType === 'INCREASE' ? 'Tìm trong hồ sơ nháp' : 'Tìm người đang làm việc'} /><Button type="button" variant="secondary" disabled={searching} onClick={searchEmployees}><Search className="mr-1 h-4 w-4" />Tìm</Button></div>
            {selectedEmployee && <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"><span><strong>{selectedEmployee.fullName}</strong> · {selectedEmployee.employeeCode}</span><button type="button" className="text-emerald-700" onClick={() => setSelectedEmployee(null)}>Đổi</button></div>}
            {!selectedEmployee && employeeResults.length > 0 && <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{employeeResults.map((employee) => <button key={employee.id} type="button" onClick={() => setSelectedEmployee(employee)} className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-emerald-300"><span><span className="block text-sm font-medium text-gray-900">{employee.fullName}</span><span className="text-xs text-gray-500">{employee.employeeCode}</span></span><HrStatusBadge status={employee.employmentStatus} label={employmentStatusLabel(employee.employmentStatus)} /></button>)}</div>}
            {!selectedEmployee && employeeSearchDone && employeeResults.length === 0 && <p className="mt-3 text-sm text-gray-500">Không tìm thấy hồ sơ phù hợp với loại biến động đã chọn.</p>}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 lg:col-span-2">Lý do{form.movementType === 'DECREASE' ? ' *' : ''}<textarea rows="3" required={form.movementType === 'DECREASE'} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" maxLength="1000" /></label>
            <label className="text-sm font-medium text-gray-700">Số quyết định<input value={form.decisionNumber} onChange={(event) => setForm((current) => ({ ...current, decisionNumber: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" maxLength="100" /></label>
            <label className="text-sm font-medium text-gray-700">Ngày ký quyết định<input type="date" value={form.decisionDate} onChange={(event) => setForm((current) => ({ ...current, decisionDate: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Đóng</Button><Button type="submit" disabled={busy === 'create' || !selectedEmployee}>Lưu bản nháp</Button></div>
        </form>
      )}

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-5 py-4">Nhân sự</th><th className="px-5 py-4">Loại</th><th className="px-5 py-4">Hiệu lực</th><th className="px-5 py-4">Thay đổi</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4">Người xử lý</th><th className="px-5 py-4">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((item) => <tr key={item.id} className="align-top hover:bg-gray-50/70"><td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{item.employeeName || item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode}</p></td><td className="px-5 py-4 text-sm text-gray-700">{movementLabel(item.movementType || item.type)}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDate(item.effectiveDate)}</td><td className="px-5 py-4"><MovementRoute item={item} />{item.reason && <p className="mt-2 max-w-sm text-xs text-gray-500">{item.reason}</p>}{item.decisionNumber && <p className="mt-1 text-xs text-gray-500">QĐ: {item.decisionNumber} · {formatHrDate(item.decisionDate)}</p>}</td><td className="px-5 py-4"><HrStatusBadge status={item.status} /></td><td className="px-5 py-4"><p className="max-w-[160px] truncate text-xs text-gray-600">{nonEmpty(item.confirmedByActor || item.cancelledByActor || item.createdByActor)}</p><p className="mt-1 whitespace-nowrap text-xs text-gray-400">{formatHrDateTime(item.confirmedAt || item.cancelledAt || item.createdAt)}</p></td><td className="px-5 py-4"><ActionButtons item={item} /></td></tr>)}{!loading && result.content.length === 0 && <tr><td colSpan="7" className="p-5"><HrEmpty title="Chưa có biến động phù hợp" /></td></tr>}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((item) => <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.employeeName || item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode} · {formatHrDate(item.effectiveDate)}</p></div><HrStatusBadge status={item.status} /></div><p className="mt-3 text-sm font-medium text-emerald-700">{movementLabel(item.movementType || item.type)}</p><div className="mt-2"><MovementRoute item={item} /></div>{item.reason && <p className="mt-2 text-xs text-gray-500">{item.reason}</p>}{item.decisionNumber && <p className="mt-1 text-xs text-gray-500">QĐ: {item.decisionNumber} · {formatHrDate(item.decisionDate)}</p>}<p className="mt-3 text-xs text-gray-400">{nonEmpty(item.confirmedByActor || item.cancelledByActor || item.createdByActor)} · {formatHrDateTime(item.confirmedAt || item.cancelledAt || item.createdAt)}</p><div className="mt-3"><ActionButtons item={item} /></div></div>)}{!loading && result.content.length === 0 && <HrEmpty title="Chưa có biến động phù hợp" />}</div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </div>
  );
}

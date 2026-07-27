import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CheckCircle2, FilePenLine, Plus, Search, Trash2, UserPlus, XCircle } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrDrawer, HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, formatHrDateTime, formatPeriod, movementLabel, nonEmpty } from '../../utils/hr';

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

function displayActor(value) {
  if (!value) return '—';
  if (String(value).startsWith('USER:')) return 'Người quản lý';
  if (String(value).startsWith('SYSTEM:')) return 'Hệ thống';
  return value;
}

function employeeInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NS';
  return parts.slice(-2).map((part) => part.charAt(0)).join('').toUpperCase();
}

function MovementTypeBadge({ type }) {
  const rehire = type === 'REHIRE';
  const increase = type === 'INCREASE' || rehire;
  return (
    <span className={`inline-flex min-w-max items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${increase
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-red-200 bg-red-50 text-red-700'}`}
    >
      {increase ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {rehire ? 'Tái tuyển' : increase ? 'Tăng' : 'Giảm'}
    </span>
  );
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
  const [confirmPreview, setConfirmPreview] = useState(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(null);

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

  const closeForm = () => {
    setShowForm(false);
    resetForm();
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

  const openAdjustment = (item) => {
    const replacementMovementType = item.movementType === 'DECREASE'
      ? 'DECREASE'
      : item.movementType === 'REHIRE'
        ? 'REHIRE'
        : 'INCREASE';
    setAdjustmentTarget(item);
    setAdjustmentForm({
      replacementMovementType,
      effectiveDate: item.effectiveDate || new Date().toISOString().slice(0, 10),
      reason: '',
      decisionNumber: item.decisionNumber || '',
      decisionDate: item.decisionDate || '',
      idempotencyKey: newIdempotencyKey(),
    });
  };

  const closeAdjustment = () => {
    setAdjustmentTarget(null);
    setAdjustmentForm(null);
  };

  const createAdjustment = async (event) => {
    event.preventDefault();
    if (!adjustmentTarget || !adjustmentForm) return;
    if (!adjustmentForm.reason.trim()) {
      toast.error('Vui lòng nhập lý do điều chỉnh để lưu lịch sử.');
      return;
    }
    setBusy(`adjust-${adjustmentTarget.id}`);
    try {
      await hrActivityApi.createMovementAdjustment(adjustmentTarget.id, {
        ...adjustmentForm,
        reason: adjustmentForm.reason.trim(),
        decisionNumber: adjustmentForm.decisionNumber.trim() || null,
        decisionDate: adjustmentForm.decisionDate || null,
        rowVersion: adjustmentTarget.rowVersion,
      });
      toast.success('Đã tạo bản điều chỉnh nháp. Hãy xem trước ảnh hưởng rồi xác nhận.');
      closeAdjustment();
      setPage(0);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tạo bản điều chỉnh.'));
    } finally {
      setBusy('');
    }
  };

  const runMovementAction = async (item, action) => {
    const messages = {
      cancel: 'Hủy biến động nháp này?',
      delete: 'Xóa vĩnh viễn biến động nháp này?',
    };
    if (action === 'confirm') {
      setBusy(`preview-${item.id}`);
      try {
        const preview = await hrActivityApi.previewMovementImpact(item.id);
        setConfirmPreview({ item, preview });
      } catch (requestError) {
        toast.error(apiErrorMessage(requestError, 'Không thể xem trước ảnh hưởng của biến động.'));
      } finally {
        setBusy('');
      }
      return;
    }
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

  const confirmPreviewedMovement = async () => {
    if (!confirmPreview) return;
    const { item } = confirmPreview;
    setBusy(`confirm-${item.id}`);
    try {
      await hrActivityApi.confirmMovement(item.id, item.rowVersion);
      toast.success(`Đã xác nhận ${movementLabel(item.movementType)} và cập nhật danh sách tháng.`);
      setConfirmPreview(null);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xác nhận biến động.'));
    } finally {
      setBusy('');
    }
  };

  const ActionButtons = ({ item }) => {
    if (item.status === 'DRAFT') {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'confirm')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Xác nhận</Button>
          <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'cancel')}><XCircle className="mr-1 h-3.5 w-3.5" />Hủy</Button>
          <Button type="button" size="sm" variant="danger" disabled={Boolean(busy)} onClick={() => runMovementAction(item, 'delete')} aria-label="Xóa biến động nháp"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      );
    }
    if (item.status === 'CONFIRMED'
      && item.sourceKind === 'MANUAL'
      && !item.correctionOfMovementId
      && !item.supersededByAdjustment
      && ['INCREASE', 'DECREASE', 'REHIRE'].includes(item.movementType)) {
      return <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => openAdjustment(item)}><FilePenLine className="mr-1 h-3.5 w-3.5" />Điều chỉnh</Button>;
    }
    const label = item.supersededByAdjustment
      ? 'Đã điều chỉnh'
      : item.correctionOfMovementId
        ? 'Bản điều chỉnh'
        : item.movementType === 'INITIAL_LOAD'
      ? 'Baseline'
      : item.status === 'CONFIRMED'
        ? 'Đã xác nhận'
        : item.status === 'CANCELLED'
          ? 'Đã hủy'
          : 'Không có thao tác';
    return <span className="inline-flex min-w-max items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">{label}</span>;
  };

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Tăng giảm nhân sự" url="https://cfcbooking.io.vn/manager/hr/movements" />
      <HrPageHeader
        title="Tăng / Giảm nhân sự"
        description="Tạo biến động nháp, kiểm tra và xác nhận. Ngày hiệu lực thuộc tháng nào thì danh sách tháng đó và các tháng sau tự cập nhật."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/employees/new')}><UserPlus className="mr-1.5 h-4 w-4" />Tạo hồ sơ nháp</Button>
            <Button type="button" onClick={() => setShowForm(true)}><Plus className="mr-1.5 h-4 w-4" />Tạo Tăng/Giảm</Button>
          </>
        )}
      />

      <HrDrawer
        isOpen={showForm}
        onClose={closeForm}
        title="Biến động nhân sự mới"
        description="Tăng dùng hồ sơ nháp; Giảm dùng hồ sơ đang làm việc. Ngày hiệu lực quyết định tháng được tính."
      >
        <form onSubmit={createMovement} className="flex min-h-full flex-col">
          <div className="flex-1 space-y-6 px-5 py-6 sm:px-7">
            <fieldset>
              <legend className="text-sm font-semibold text-[var(--cfc-ink)]">Loại biến động <span className="text-red-500">*</span></legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={form.movementType === 'INCREASE'}
                  onClick={() => changeMovementType('INCREASE')}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${form.movementType === 'INCREASE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current"><ArrowUp className="h-4 w-4" /></span>
                  Tăng nhân sự
                </button>
                <button
                  type="button"
                  aria-pressed={form.movementType === 'DECREASE'}
                  onClick={() => changeMovementType('DECREASE')}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${form.movementType === 'DECREASE'
                    ? 'border-red-400 bg-red-50 text-red-700 ring-1 ring-red-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current"><ArrowDown className="h-4 w-4" /></span>
                  Giảm nhân sự
                </button>
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-[var(--cfc-ink)]">
              Ngày hiệu lực <span className="text-red-500">*</span>
              <input
                type="date"
                required
                value={form.effectiveDate}
                onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div>
              <label htmlFor="movement-employee-search" className="text-sm font-semibold text-[var(--cfc-ink)]">
                Nhân sự <span className="text-red-500">*</span>
              </label>
              <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="movement-employee-search"
                    value={employeeKeyword}
                    onChange={(event) => setEmployeeKeyword(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
                    placeholder={form.movementType === 'INCREASE' ? 'Tìm trong hồ sơ nháp' : 'Tìm người đang làm việc'}
                  />
                </div>
                <Button type="button" variant="secondary" disabled={searching} onClick={searchEmployees}>Tìm</Button>
              </div>
              {selectedEmployee && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm">
                  <span className="min-w-0">
                    <strong className="block truncate text-gray-900">{selectedEmployee.fullName}</strong>
                    <span className="text-xs text-gray-500">{selectedEmployee.employeeCode}</span>
                  </span>
                  <button type="button" className="shrink-0 font-semibold text-emerald-700" onClick={() => setSelectedEmployee(null)}>Đổi</button>
                </div>
              )}
              {!selectedEmployee && employeeResults.length > 0 && (
                <div className="cfc-scrollbar mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {employeeResults.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployee(employee)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{employee.fullName}</span>
                        <span className="text-xs text-gray-500">{employee.employeeCode}</span>
                      </span>
                      <HrStatusBadge status={employee.employmentStatus} label={employmentStatusLabel(employee.employmentStatus)} />
                    </button>
                  ))}
                </div>
              )}
              {!selectedEmployee && employeeSearchDone && employeeResults.length === 0 && <p className="mt-3 text-sm text-gray-500">Không tìm thấy hồ sơ phù hợp với loại biến động đã chọn.</p>}
            </div>

            <label className="block text-sm font-semibold text-[var(--cfc-ink)]">
              Lý do{form.movementType === 'DECREASE' ? <span className="text-red-500"> *</span> : null}
              <textarea
                rows="4"
                required={form.movementType === 'DECREASE'}
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
                maxLength="1000"
                placeholder={form.movementType === 'INCREASE' ? 'Ví dụ: Tuyển dụng mới' : 'Ví dụ: Nghỉ việc theo quyết định'}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[var(--cfc-ink)]">Số quyết định<input value={form.decisionNumber} onChange={(event) => setForm((current) => ({ ...current, decisionNumber: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" maxLength="100" /></label>
              <label className="text-sm font-semibold text-[var(--cfc-ink)]">Ngày ký quyết định<input type="date" value={form.decisionDate} onChange={(event) => setForm((current) => ({ ...current, decisionDate: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" /></label>
            </div>
          </div>
          <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-[var(--cfc-border)] bg-white px-5 py-4 sm:justify-end sm:px-7">
            <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={closeForm}>Hủy</Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={busy === 'create' || !selectedEmployee}>Lưu bản nháp</Button>
          </div>
        </form>
      </HrDrawer>

      <HrDrawer
        isOpen={Boolean(adjustmentTarget && adjustmentForm)}
        onClose={closeAdjustment}
        title="Điều chỉnh biến động đã xác nhận"
        description="Bản ghi cũ được giữ nguyên để đối soát. Bản điều chỉnh sẽ thay thế ảnh hưởng của nó sau khi được xác nhận."
      >
        {adjustmentTarget && adjustmentForm && (
          <form onSubmit={createAdjustment} className="flex min-h-full flex-col">
            <div className="flex-1 space-y-5 px-5 py-6 sm:px-7">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Đang điều chỉnh {movementLabel(adjustmentTarget.movementType).toLowerCase()} của {adjustmentTarget.employeeName}</p><p className="mt-1 leading-5">Biến động gốc ngày {formatHrDate(adjustmentTarget.effectiveDate)} không bị xóa. Hãy ghi rõ lý do để lịch sử nhân sự đầy đủ.</p></div></div>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-[var(--cfc-ink)]">Cách điều chỉnh <span className="text-red-500">*</span></legend>
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentForm((current) => ({ ...current, replacementMovementType: adjustmentTarget.movementType, idempotencyKey: newIdempotencyKey() }))}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${adjustmentForm.replacementMovementType === adjustmentTarget.movementType ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'border-gray-200 bg-white text-gray-700'}`}
                  >
                    <span className="block font-semibold">Sửa ngày hiệu lực / thông tin quyết định</span>
                    <span className="mt-0.5 block text-xs opacity-80">Giữ nguyên loại {movementLabel(adjustmentTarget.movementType).toLowerCase()}, chỉ thay thế mốc áp dụng hoặc nội dung đã nhập sai.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentForm((current) => ({ ...current, replacementMovementType: adjustmentTarget.movementType === 'DECREASE' ? 'REHIRE' : 'DECREASE', idempotencyKey: newIdempotencyKey() }))}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${adjustmentForm.replacementMovementType !== adjustmentTarget.movementType ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-100' : 'border-gray-200 bg-white text-gray-700'}`}
                  >
                    <span className="block font-semibold">Đảo nghiệp vụ đã xác nhận</span>
                    <span className="mt-0.5 block text-xs opacity-80">{adjustmentTarget.movementType === 'DECREASE' ? 'Đưa nhân sự trở lại danh sách bằng nghiệp vụ tái tuyển.' : 'Loại ảnh hưởng của tăng/tái tuyển đã xác nhận khỏi quân số.'}</span>
                  </button>
                </div>
              </fieldset>
              <label className="block text-sm font-semibold text-[var(--cfc-ink)]">Ngày hiệu lực mới <span className="text-red-500">*</span><input type="date" required value={adjustmentForm.effectiveDate} onChange={(event) => setAdjustmentForm((current) => ({ ...current, effectiveDate: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block text-sm font-semibold text-[var(--cfc-ink)]">Lý do điều chỉnh <span className="text-red-500">*</span><textarea rows="4" required value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))} className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" maxLength="1000" placeholder="Ví dụ: Đơn vị báo muộn, điều chỉnh lại ngày nghỉ việc theo quyết định." /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[var(--cfc-ink)]">Số quyết định<input value={adjustmentForm.decisionNumber} onChange={(event) => setAdjustmentForm((current) => ({ ...current, decisionNumber: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" maxLength="100" /></label><label className="text-sm font-semibold text-[var(--cfc-ink)]">Ngày ký quyết định<input type="date" value={adjustmentForm.decisionDate} onChange={(event) => setAdjustmentForm((current) => ({ ...current, decisionDate: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal outline-none transition focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100" /></label></div>
            </div>
            <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-[var(--cfc-border)] bg-white px-5 py-4 sm:justify-end sm:px-7"><Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={closeAdjustment}>Hủy</Button><Button type="submit" className="flex-1 sm:flex-none" disabled={Boolean(busy)}>Tạo bản điều chỉnh nháp</Button></div>
          </form>
        )}
      </HrDrawer>

      <HrDrawer
        isOpen={Boolean(confirmPreview)}
        onClose={() => setConfirmPreview(null)}
        title="Xem trước ảnh hưởng trước khi xác nhận"
        description="Đây là phép tính đọc dữ liệu hiện tại. Chỉ sau khi bấm xác nhận, danh sách tháng mới thay đổi."
      >
        {confirmPreview && (
          <div className="flex min-h-full flex-col">
            <div className="flex-1 space-y-5 px-5 py-6 sm:px-7">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">{movementLabel(confirmPreview.item.movementType)} · {confirmPreview.item.employeeName}</p><p className="mt-1 text-blue-800">Hiệu lực: {formatHrDate(confirmPreview.item.effectiveDate)}. Các tháng dưới đây được tính đến cuối tháng.</p></div>
              <div className="overflow-hidden rounded-xl border border-[var(--cfc-border)]"><div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-[var(--cfc-surface-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cfc-muted)]"><span>Tháng</span><span>Trước</span><span>Sau</span></div>{confirmPreview.preview.periods.map((period) => <div key={period.periodStart} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-gray-100 px-4 py-3 text-sm"><span className="font-semibold text-[var(--cfc-ink)]">{formatPeriod(period.periodStart)}</span><span className="text-gray-500">{period.beforeHeadcount}</span><span className={`font-semibold ${period.delta === 0 ? 'text-gray-700' : period.delta > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{period.afterHeadcount} {period.delta !== 0 && <small>({period.delta > 0 ? '+' : ''}{period.delta})</small>}</span></div>)}</div>
              {!confirmPreview.preview.periods.length && <p className="text-sm text-[var(--cfc-muted)]">Không có tháng nào chịu ảnh hưởng trong phạm vi dữ liệu hiện tại.</p>}
            </div>
            <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-[var(--cfc-border)] bg-white px-5 py-4 sm:justify-end sm:px-7"><Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setConfirmPreview(null)}>Quay lại</Button><Button type="button" className="flex-1 sm:flex-none" disabled={Boolean(busy)} onClick={confirmPreviewedMovement}><CheckCircle2 className="mr-1.5 h-4 w-4" />Xác nhận áp dụng</Button></div>
          </div>
        )}
      </HrDrawer>

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--cfc-ink)]">Lịch sử biến động</h2>
          <p className="mt-1 text-sm text-[var(--cfc-muted)]">Các bản nháp cần được xác nhận trước khi làm thay đổi quân số tháng.</p>
        </div>
        {!loading && <span className="shrink-0 text-sm font-medium text-[var(--cfc-muted)]">{result.totalElements} bản ghi</span>}
      </div>
      <div className="hr-responsive-table hr-responsive-table--wide cfc-scrollbar overflow-x-auto rounded-xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-sm)]">
        <table className="w-full min-w-[1080px] divide-y divide-[var(--cfc-border)]">
          <thead className="bg-[var(--cfc-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cfc-muted)]">
            <tr>
              <th className="px-5 py-4">Nhân sự</th>
              <th className="px-5 py-4">Loại</th>
              <th className="px-5 py-4">Hiệu lực</th>
              <th className="px-5 py-4">Thay đổi</th>
              <th className="px-5 py-4">Trạng thái</th>
              <th className="px-5 py-4">Người xử lý</th>
              <th className="px-5 py-4">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr>
            ) : result.content.map((item) => {
              const name = item.employeeName || item.fullName;
              const type = item.movementType || item.type;
              return (
                <tr key={item.id} className="align-top transition hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${type === 'DECREASE' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{employeeInitials(name)}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--cfc-ink)]">{name}</span>
                        <span className="mt-0.5 block text-xs text-[var(--cfc-muted)]">{item.employeeCode}</span>
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4"><MovementTypeBadge type={type} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDate(item.effectiveDate)}</td>
                  <td className="px-5 py-4">
                    <MovementRoute item={item} />
                    {item.correctionOfMovementId && <p className="mt-2 text-xs font-medium text-amber-700">Bản điều chỉnh của biến động {movementLabel(item.correctionOfMovementType).toLowerCase()} ngày {formatHrDate(item.correctionOfEffectiveDate)}</p>}
                    {item.supersededByAdjustment && <p className="mt-2 text-xs font-medium text-amber-700">Đã được thay thế bởi một bản điều chỉnh có lưu lịch sử.</p>}
                    {item.reason && <p className="mt-2 max-w-sm text-xs leading-5 text-gray-500">{item.reason}</p>}
                    {item.decisionNumber && <p className="mt-1 text-xs text-gray-500">QĐ: {item.decisionNumber} · {formatHrDate(item.decisionDate)}</p>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4"><HrStatusBadge status={item.status} /></td>
                  <td className="px-5 py-4">
                    <p className="max-w-[180px] truncate text-xs font-semibold text-gray-700">{displayActor(item.confirmedByActor || item.cancelledByActor || item.createdByActor)}</p>
                    <p className="mt-1 whitespace-nowrap text-xs text-gray-400">{formatHrDateTime(item.confirmedAt || item.cancelledAt || item.createdAt)}</p>
                  </td>
                  <td className="px-5 py-4"><ActionButtons item={item} /></td>
                </tr>
              );
            })}
            {!loading && result.content.length === 0 && <tr><td colSpan="7" className="p-5"><HrEmpty title="Chưa có biến động phù hợp" description="Tạo biến động mới để bắt đầu theo dõi tăng hoặc giảm nhân sự." /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="hr-responsive-cards hr-responsive-cards--wide space-y-3">
        {loading ? (
          <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div>
        ) : result.content.map((item) => {
          const name = item.employeeName || item.fullName;
          const type = item.movementType || item.type;
          return (
            <article key={item.id} className="rounded-xl border border-[var(--cfc-border)] bg-white p-4 shadow-[var(--cfc-shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${type === 'DECREASE' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{employeeInitials(name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--cfc-ink)]">{name}</p>
                    <p className="mt-0.5 text-xs text-[var(--cfc-muted)]">{item.employeeCode} · {formatHrDate(item.effectiveDate)}</p>
                  </div>
                </div>
                <HrStatusBadge status={item.status} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <MovementTypeBadge type={type} />
                <p className="truncate text-xs font-medium text-gray-500">{displayActor(item.confirmedByActor || item.cancelledByActor || item.createdByActor)}</p>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--cfc-surface-muted)] p-3"><MovementRoute item={item} /></div>
              {item.correctionOfMovementId && <p className="mt-3 text-xs font-medium text-amber-700">Bản điều chỉnh của biến động {movementLabel(item.correctionOfMovementType).toLowerCase()} ngày {formatHrDate(item.correctionOfEffectiveDate)}</p>}
              {item.supersededByAdjustment && <p className="mt-3 text-xs font-medium text-amber-700">Đã được thay thế bởi một bản điều chỉnh có lưu lịch sử.</p>}
              {item.reason && <p className="mt-3 text-sm leading-5 text-gray-600">{item.reason}</p>}
              {item.decisionNumber && <p className="mt-1 text-xs text-gray-500">QĐ: {item.decisionNumber} · {formatHrDate(item.decisionDate)}</p>}
              <p className="mt-3 text-xs text-gray-400">{formatHrDateTime(item.confirmedAt || item.cancelledAt || item.createdAt)}</p>
              <div className="mt-4 border-t border-gray-100 pt-3"><ActionButtons item={item} /></div>
            </article>
          );
        })}
        {!loading && result.content.length === 0 && <HrEmpty title="Chưa có biến động phù hợp" description="Tạo biến động mới để bắt đầu theo dõi tăng hoặc giảm nhân sự." />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </HrPageShell>
  );
}

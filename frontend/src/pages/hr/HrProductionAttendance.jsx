import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, Eye, FileSpreadsheet,
  Lock, RefreshCw, Settings2, Unlock, UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { hrProductionAttendanceApi as api } from '../../api/hrProductionAttendanceApi';
import { authApi } from '../../api/authApi';
import {
  HrDrawer, HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge,
} from '../../components/hr/HrUi';
import { Button } from '../../components/ui/Button';
import SEOHead from '../../components/SEOHead';
import { apiErrorMessage, formatHrDate, formatHrDateTime } from '../../utils/hr';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const emptyPage = { content: [], page: 0, totalPages: 0, totalElements: 0 };
const views = [
  ['ALL', 'Tất cả'], ['PRODUCTION_WORKER', 'Công nhân'], ['KCS', 'KCS'],
  ['NEEDS_REVIEW', 'Cần kiểm tra'], ['INCIDENT', 'Sự cố máy'], ['CONFIRMED', 'Đã xác nhận'],
];

function money(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function work(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function time(value) {
  if (!value) return '—';
  return formatHrDateTime(value);
}

function policyLabel(value) {
  return { PRODUCTION_WORKER: 'Công nhân', KCS: 'KCS', OFFICE: 'Hành chính' }[value] || value || '—';
}

function downloadBlob(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] || fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AttendanceTabs({ onSelectMode }) {
  return <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
    <button type="button" onClick={() => onSelectMode('administrative')} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Hành chính</button>
    <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Ca sản xuất</button>
  </div>;
}

function Metric({ label, value, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-50', green: 'bg-emerald-50', amber: 'bg-amber-50', blue: 'bg-blue-50' };
  return <div className={`rounded-xl border border-gray-100 p-4 ${tones[tone] || tones.slate}`}>
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
  </div>;
}

function ImportCard({ item, active, canReopen, onSelect, onConfirm, onRecalculate, onReopen }) {
  return <div className={`w-full rounded-xl border p-4 text-left transition ${active ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-200'}`}>
    <button type="button" onClick={onSelect} className="w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{item.sourceFileName}</p><p className="mt-1 text-xs text-gray-500">{item.attendanceMonth} · lần tính {item.processingVersion}</p></div>
        <HrStatusBadge status={item.status} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div><p className="font-semibold">{item.totalRows}</p><p className="text-gray-500">Dòng</p></div>
        <div><p className="font-semibold text-emerald-700">{item.autoMatchedShifts}</p><p className="text-gray-500">Tự ghép</p></div>
        <div><p className="font-semibold text-amber-700">{item.reviewShifts}</p><p className="text-gray-500">Kiểm tra</p></div>
        <div><p className="font-semibold text-gray-600">{item.noPunchRows}</p><p className="text-gray-500">Trống</p></div>
      </div>
    </button>
    <div className="mt-3 flex flex-wrap gap-2">
      {item.status === 'PREVIEWED' && <>
        <Button type="button" size="sm" variant="secondary" onClick={onRecalculate}><RefreshCw className="h-3.5 w-3.5" />Tính lại</Button>
        <Button type="button" size="sm" onClick={onConfirm}><Lock className="h-3.5 w-3.5" />Chốt</Button>
      </>}
      {item.status === 'CONFIRMED' && canReopen && <Button type="button" size="sm" variant="secondary" onClick={onReopen}><Unlock className="h-3.5 w-3.5" />Mở khóa</Button>}
    </div>
  </div>;
}

function ShiftDecisionDrawer({ shift, policies, readOnly, onClose, onSaved }) {
  const [punches, setPunches] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!shift) return;
    setForm({
      action: 'CONFIRM', shiftCode: shift.shiftCode || '', checkInPunchId: '', checkOutPunchId: '',
      workValue: String(shift.workValue ?? 0), nightAllowanceAmount: String(shift.nightAllowanceAmount ?? 0), reason: '',
    });
    Promise.all([api.shiftPunches(shift.id), api.adjustments(shift.id)])
      .then(([nextPunches, nextAdjustments]) => {
        setPunches(nextPunches || []); setAdjustments(nextAdjustments || []);
        setForm((value) => ({ ...value, checkInPunchId: shift.checkInAt ? (nextPunches || []).find((item) => item.punchedAt === shift.checkInAt)?.id || '' : '', checkOutPunchId: shift.checkOutAt ? (nextPunches || []).find((item) => item.punchedAt === shift.checkOutAt)?.id || '' : '' }));
      })
      .catch((error) => toast.error(apiErrorMessage(error, 'Không tải được chi tiết ca.')));
  }, [shift]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.reason.trim()) return toast.error('Phải nhập lý do quyết định.');
    setSaving(true);
    try {
      await api.decideShift(shift.id, {
        ...form,
        shiftCode: form.shiftCode || null,
        checkInPunchId: form.checkInPunchId || null,
        checkOutPunchId: form.checkOutPunchId || null,
        workValue: Number(form.workValue),
        nightAllowanceAmount: Number(form.nightAllowanceAmount),
        rowVersion: shift.rowVersion,
      });
      toast.success(form.action === 'REJECT' ? 'Đã từ chối ca.' : 'Đã xác nhận điều chỉnh ca.');
      onSaved();
    } catch (error) { toast.error(apiErrorMessage(error, 'Không thể lưu quyết định ca.')); }
    finally { setSaving(false); }
  };

  return <HrDrawer isOpen={Boolean(shift)} onClose={onClose} title={shift ? `${shift.employeeCode} · ${formatHrDate(shift.workDate)}` : ''} description="Dấu chấm gốc không bị sửa; mọi quyết định đều lưu lịch sử." size="wide">
    {shift && form && <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">Quyết định<select disabled={readOnly} value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="CONFIRM">Xác nhận/điều chỉnh</option><option value="REJECT">Từ chối, tính 0 công</option></select></label>
        <label className="text-sm font-medium text-gray-700">Ca<select disabled={readOnly} value={form.shiftCode} onChange={(event) => setForm({ ...form, shiftCode: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Giữ ca đề xuất</option>{policies.filter((item) => item.policyGroup === shift.policyGroup).map((item) => <option key={item.id} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Lượt vào<select disabled={readOnly} value={form.checkInPunchId} onChange={(event) => setForm({ ...form, checkInPunchId: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Để trống</option>{punches.map((item) => <option key={item.id} value={item.id}>{time(item.punchedAt)} · cột {item.sourceColumn}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Lượt ra<select disabled={readOnly} value={form.checkOutPunchId} onChange={(event) => setForm({ ...form, checkOutPunchId: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Để trống</option>{punches.map((item) => <option key={item.id} value={item.id}>{time(item.punchedAt)} · cột {item.sourceColumn}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Số công<select disabled={readOnly} value={form.workValue} onChange={(event) => setForm({ ...form, workValue: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="0">0</option><option value="1">1</option><option value="1.5">1,5</option><option value="2">2</option></select></label>
        <label className="text-sm font-medium text-gray-700">Phụ cấp đêm<input disabled={readOnly} type="number" min="0" step="1000" value={form.nightAllowanceAmount} onChange={(event) => setForm({ ...form, nightAllowanceAmount: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
      </div>
      {!readOnly && <label className="block text-sm font-medium text-gray-700">Lý do bắt buộc<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-3" /></label>}
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-gray-600"><p className="font-semibold text-gray-800">Giải thích hệ thống</p><p className="mt-1">{shift.explanation || 'Không có.'}</p></div>
      <div><h3 className="text-sm font-semibold text-gray-900">Dấu chấm gốc</h3><div className="mt-2 space-y-2">{punches.map((item) => <div key={item.id} className="flex justify-between rounded-lg border border-gray-200 p-3 text-sm"><span>{time(item.punchedAt)}</span><span className="text-gray-500">Dòng {item.sourceRowNumber} · {item.sourceColumn} · {item.rawValue}</span></div>)}{!punches.length && <p className="text-sm text-gray-500">Không có dấu chấm.</p>}</div></div>
      <details><summary className="cursor-pointer text-sm font-semibold text-gray-800">Lịch sử điều chỉnh ({adjustments.length})</summary><div className="mt-2 space-y-2">{adjustments.map((item) => <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm"><p>{item.reason}</p><p className="mt-1 text-xs text-gray-500">{formatHrDateTime(item.createdAt)} · {item.createdByActor}</p></div>)}</div></details>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>{readOnly ? 'Đóng' : 'Hủy'}</Button>{!readOnly && <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu quyết định'}</Button>}</div>
    </form>}
  </HrDrawer>;
}

function ConfigurationDrawer({ open, policies, creditRules, onClose, onRefresh }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [employeePolicies, setEmployeePolicies] = useState([]);
  const [exemptions, setExemptions] = useState([]);
  const [assignment, setAssignment] = useState({ policyGroup: 'PRODUCTION_WORKER', validFrom: currentMonth() + '-01', validTo: '', reason: '' });
  const [exemption, setExemption] = useState({ validFrom: currentMonth() + '-01', validTo: currentMonth() + '-01', reason: '' });

  const lookup = async () => {
    if (!employeeCode.trim()) return toast.error('Nhập mã nhân viên.');
    try {
      const [nextPolicies, nextExemptions] = await Promise.all([api.employeePolicies(employeeCode.trim()), api.exemptions(employeeCode.trim())]);
      setEmployeePolicies(nextPolicies || []); setExemptions(nextExemptions || []);
    } catch (error) { toast.error(apiErrorMessage(error, 'Không tìm thấy nhân viên.')); }
  };

  const savePolicy = async (item, form) => {
    try { await api.updateShiftPolicy(item.id, { name: form.name, standardStart: form.standardStart, standardEnd: form.standardEnd, checkInFrom: form.checkInFrom, checkInUntil: form.checkInUntil, checkOutFrom: form.checkOutFrom, checkOutUntil: form.checkOutUntil, nightAllowanceAmount: Number(form.nightAllowanceAmount), priority: Number(form.priority), active: form.active, validFrom: form.validFrom, validTo: form.validTo || null, rowVersion: item.rowVersion }); toast.success('Đã lưu cấu hình ca.'); onRefresh(); }
    catch (error) { toast.error(apiErrorMessage(error, 'Không thể lưu cấu hình ca.')); }
  };
  const saveCreditRule = async (item, form) => {
    try { await api.updateWorkCreditRule(item.id, { name: form.name, checkOutFrom: form.checkOutFrom, checkOutUntil: form.checkOutUntil, workValue: Number(form.workValue), priority: Number(form.priority), active: form.active, validFrom: form.validFrom, validTo: form.validTo || null, rowVersion: item.rowVersion }); toast.success('Đã lưu ngưỡng tính công.'); onRefresh(); }
    catch (error) { toast.error(apiErrorMessage(error, 'Không thể lưu ngưỡng tính công.')); }
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    try { await api.createEmployeePolicy({ employeeCode: employeeCode.trim(), ...assignment, validTo: assignment.validTo || null }); toast.success('Đã gán nhóm chấm công.'); setAssignment({ ...assignment, reason: '' }); lookup(); }
    catch (error) { toast.error(apiErrorMessage(error, 'Không thể gán nhóm chấm công.')); }
  };

  const createExemption = async (event) => {
    event.preventDefault();
    try { await api.createExemption({ employeeCode: employeeCode.trim(), ...exemption }); toast.success('Đã tạo miễn chấm.'); setExemption({ ...exemption, reason: '' }); lookup(); }
    catch (error) { toast.error(apiErrorMessage(error, 'Không thể tạo miễn chấm.')); }
  };

  return <HrDrawer isOpen={open} onClose={onClose} title="Cấu hình ca sản xuất" description="Ca, nhóm chính sách theo thời gian và miễn chấm được quản lý độc lập." size="wide">
    <div className="space-y-6 p-5 sm:p-7">
      <section><h3 className="font-semibold text-gray-900">Cửa nhận diện ca</h3><div className="mt-3 space-y-3">{policies.map((item) => <ShiftPolicyEditor key={`${item.id}-${item.rowVersion}`} item={item} onSave={savePolicy} />)}</div></section>
      <section className="border-t border-gray-200 pt-5"><h3 className="font-semibold text-gray-900">Ngưỡng quy đổi công</h3><p className="mt-1 text-sm text-gray-500">Chỉ cho phép 0, 1, 1,5 hoặc 2 công. File đã chốt không tự đổi theo cấu hình mới.</p><div className="mt-3 space-y-3">{creditRules.map((item) => <CreditRuleEditor key={`${item.id}-${item.rowVersion}`} item={item} policy={policies.find((policy) => policy.id === item.shiftPolicyId)} onSave={saveCreditRule} />)}</div></section>
      <section className="border-t border-gray-200 pt-5"><h3 className="font-semibold text-gray-900">Nhân viên và miễn chấm</h3><div className="mt-3 flex gap-2"><input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())} placeholder="Mã nhân viên" className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3" /><Button type="button" variant="secondary" onClick={lookup}>Tra cứu</Button></div>
        <form onSubmit={createAssignment} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><p className="font-semibold sm:col-span-2">Gán nhóm chấm công</p><select value={assignment.policyGroup} onChange={(event) => setAssignment({ ...assignment, policyGroup: event.target.value })} className="h-11 rounded-lg border border-gray-300 bg-white px-3"><option value="PRODUCTION_WORKER">Công nhân</option><option value="KCS">KCS</option><option value="OFFICE">Hành chính</option></select><input value={assignment.reason} onChange={(event) => setAssignment({ ...assignment, reason: event.target.value })} required placeholder="Lý do" className="h-11 rounded-lg border border-gray-300 px-3" /><input type="date" value={assignment.validFrom} onChange={(event) => setAssignment({ ...assignment, validFrom: event.target.value })} required className="h-11 rounded-lg border border-gray-300 px-3" /><input type="date" value={assignment.validTo} onChange={(event) => setAssignment({ ...assignment, validTo: event.target.value })} className="h-11 rounded-lg border border-gray-300 px-3" /><Button type="submit" className="sm:col-span-2">Lưu nhóm chính sách</Button></form>
        <div className="mt-3 space-y-2">{employeePolicies.map((item) => <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm"><b>{policyLabel(item.policyGroup)}</b> · {formatHrDate(item.validFrom)} → {formatHrDate(item.validTo)}<p className="text-gray-500">{item.reason}</p></div>)}</div>
        <form onSubmit={createExemption} className="mt-4 grid gap-3 rounded-xl bg-amber-50 p-4 sm:grid-cols-2"><p className="font-semibold sm:col-span-2">Tạo miễn chấm có thời hạn</p><input type="date" value={exemption.validFrom} onChange={(event) => setExemption({ ...exemption, validFrom: event.target.value })} required className="h-11 rounded-lg border border-gray-300 px-3" /><input type="date" value={exemption.validTo} onChange={(event) => setExemption({ ...exemption, validTo: event.target.value })} required className="h-11 rounded-lg border border-gray-300 px-3" /><input value={exemption.reason} onChange={(event) => setExemption({ ...exemption, reason: event.target.value })} required placeholder="Lý do: công tác, đi thị trường..." className="h-11 rounded-lg border border-gray-300 px-3 sm:col-span-2" /><Button type="submit" className="sm:col-span-2">Tạo miễn chấm</Button></form>
        <div className="mt-3 space-y-2">{exemptions.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm"><div><HrStatusBadge status={item.status} /><p className="mt-1">{formatHrDate(item.validFrom)} → {formatHrDate(item.validTo)} · {item.reason}</p></div>{item.status === 'CONFIRMED' && <Button type="button" size="sm" variant="secondary" onClick={async () => { const reason = window.prompt('Lý do hủy miễn chấm:'); if (!reason?.trim()) return; try { await api.cancelExemption(item.id, { reason: reason.trim(), rowVersion: item.rowVersion }); toast.success('Đã hủy miễn chấm.'); lookup(); } catch (error) { toast.error(apiErrorMessage(error, 'Không thể hủy miễn chấm.')); } }}>Hủy</Button>}</div>)}</div>
      </section>
    </div>
  </HrDrawer>;
}

function ShiftPolicyEditor({ item, onSave }) {
  const [form, setForm] = useState({ ...item });
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return <details className="rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-gray-900">{item.code} · {item.name} · {policyLabel(item.policyGroup)}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={form.name} onChange={(event) => set('name', event.target.value)} className="h-10 rounded-lg border border-gray-300 px-3" /><input type="number" value={form.priority} onChange={(event) => set('priority', event.target.value)} className="h-10 rounded-lg border border-gray-300 px-3" />{[['standardStart', 'Giờ bắt đầu'], ['standardEnd', 'Giờ kết thúc'], ['checkInFrom', 'Vào từ'], ['checkInUntil', 'Vào đến'], ['checkOutFrom', 'Ra từ'], ['checkOutUntil', 'Ra đến']].map(([field, label]) => <label key={field} className="text-xs text-gray-500">{label}<input type="time" value={String(form[field] || '').slice(0, 5)} onChange={(event) => set(field, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label>)}<label className="text-xs text-gray-500">Phụ cấp đêm<input type="number" min="0" value={form.nightAllowanceAmount} onChange={(event) => set('nightAllowanceAmount', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} />Đang áp dụng</label><Button type="button" className="sm:col-span-2" onClick={() => onSave(item, { ...form, validTo: form.validTo || null })}>Lưu ca {item.code}</Button></div></details>;
}

function CreditRuleEditor({ item, policy, onSave }) {
  const [form, setForm] = useState({ ...item });
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return <details className="rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-gray-900">{policy?.code || 'Ca'} · {item.name} · {work(item.workValue)} công</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={form.name} onChange={(event) => set('name', event.target.value)} className="h-10 rounded-lg border border-gray-300 px-3" /><select value={form.workValue} onChange={(event) => set('workValue', event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="0">0 công</option><option value="1">1 công</option><option value="1.5">1,5 công</option><option value="2">2 công</option></select><label className="text-xs text-gray-500">Giờ ra từ<input type="time" value={String(form.checkOutFrom || '').slice(0, 5)} onChange={(event) => set('checkOutFrom', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label><label className="text-xs text-gray-500">Giờ ra đến<input type="time" value={String(form.checkOutUntil || '').slice(0, 5)} onChange={(event) => set('checkOutUntil', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label><input type="number" value={form.priority} onChange={(event) => set('priority', event.target.value)} className="h-10 rounded-lg border border-gray-300 px-3" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} />Đang áp dụng</label><Button type="button" className="sm:col-span-2" onClick={() => onSave(item, form)}>Lưu ngưỡng</Button></div></details>;
}

function IncidentDrawer({ open, activeImport, incidents, onClose, onRefresh }) {
  const [form, setForm] = useState({ startedAt: '', endedAt: '', scopeType: 'ALL', scopeValues: '', description: '' });
  const [activeIncident, setActiveIncident] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const create = async (event) => {
    event.preventDefault();
    try {
      const created = await api.createIncident({ ...form, scopeValues: form.scopeValues.split(',').map((item) => item.trim()).filter(Boolean) });
      setActiveIncident(created); toast.success('Đã tạo bản nháp sự cố.'); onRefresh();
    } catch (error) { toast.error(apiErrorMessage(error, 'Không thể tạo sự cố.')); }
  };
  const analyze = async (incident) => {
    if (!activeImport) return toast.error('Chọn file import cần phân tích.');
    try { const result = await api.analyzeIncident(incident.id, activeImport.id); setActiveIncident(incident); setCandidates(result || []); setSelected(new Set()); }
    catch (error) { toast.error(apiErrorMessage(error, 'Không thể phân tích sự cố.')); }
  };
  const confirm = async () => {
    if (!selected.size) return toast.error('Chọn ít nhất một ca bị ảnh hưởng.');
    const reason = window.prompt('Lý do xác nhận các ca sự cố:'); if (!reason?.trim()) return;
    try {
      await api.confirmIncident(activeIncident.id, activeImport.id, { selections: candidates.filter((item) => selected.has(item.shiftId)).map((item) => ({ shiftId: item.shiftId, workValue: item.proposedWorkValue || 1.5, nightAllowanceAmount: item.proposedNightAllowance || 0 })), reason: reason.trim() });
      toast.success('Đã xác nhận sự cố và các ca được chọn.'); setCandidates([]); setSelected(new Set()); onRefresh();
    } catch (error) { toast.error(apiErrorMessage(error, 'Không thể xác nhận sự cố.')); }
  };

  return <HrDrawer isOpen={open} onClose={onClose} title="Sự cố máy chấm công" description="Chỉ đề xuất ca có một dấu thật; không tạo giờ chấm giả." size="wide"><div className="space-y-5 p-5 sm:p-7"><form onSubmit={create} className="grid gap-3 sm:grid-cols-2"><input type="datetime-local" required value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} className="h-11 rounded-lg border border-gray-300 px-3" /><input type="datetime-local" required value={form.endedAt} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} className="h-11 rounded-lg border border-gray-300 px-3" /><select value={form.scopeType} onChange={(event) => setForm({ ...form, scopeType: event.target.value })} className="h-11 rounded-lg border border-gray-300 bg-white px-3"><option value="ALL">Toàn bộ</option><option value="EMPLOYEE_CODES">Mã nhân viên</option><option value="POLICY_GROUP">Nhóm chính sách</option><option value="DEPARTMENT">Phòng ban</option></select><input disabled={form.scopeType === 'ALL'} value={form.scopeValues} onChange={(event) => setForm({ ...form, scopeValues: event.target.value })} placeholder="Giá trị, cách nhau dấu phẩy" className="h-11 rounded-lg border border-gray-300 px-3" /><textarea required rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Mô tả sự cố" className="rounded-lg border border-gray-300 p-3 sm:col-span-2" /><Button type="submit" className="sm:col-span-2">Tạo bản nháp sự cố</Button></form><section><h3 className="font-semibold">Lịch sử sự cố</h3><div className="mt-2 space-y-2">{incidents.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-sm"><div><HrStatusBadge status={item.status} /><p className="mt-1">{time(item.startedAt)} → {time(item.endedAt)}</p><p className="text-gray-500">{item.description}</p></div>{item.status === 'DRAFT' && <div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => analyze(item)}>Phân tích</Button><Button type="button" size="sm" variant="danger" onClick={async () => { if (!window.confirm('Hủy bản nháp sự cố này?')) return; try { await api.cancelIncident(item.id); toast.success('Đã hủy sự cố.'); onRefresh(); } catch (error) { toast.error(apiErrorMessage(error, 'Không thể hủy sự cố.')); } }}>Hủy</Button></div>}</div>)}</div></section>{activeIncident && <section className="border-t border-gray-200 pt-4"><h3 className="font-semibold">Ca đề xuất ({candidates.length})</h3><div className="mt-2 space-y-2">{candidates.map((item) => <label key={item.shiftId} className="flex gap-3 rounded-lg border border-gray-200 p-3 text-sm"><input type="checkbox" checked={selected.has(item.shiftId)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.shiftId); else next.delete(item.shiftId); return next; })} /><span><b>{item.employeeCode}</b> · {formatHrDate(item.workDate)} · {item.shiftCode || 'Chưa rõ ca'}<span className="block text-gray-500">Thiếu dấu dự kiến {time(item.missingExpectedAt)} · đề xuất {work(item.proposedWorkValue)} công</span></span></label>)}{!candidates.length && <p className="text-sm text-gray-500">Không có ca phù hợp trong phạm vi sự cố.</p>}</div>{candidates.length > 0 && <Button type="button" className="mt-3" onClick={confirm}>Xác nhận {selected.size} ca đã chọn</Button>}</section>}</div></HrDrawer>;
}

export default function HrProductionAttendance({ onSelectMode }) {
  const [month, setMonth] = useState(currentMonth());
  const [imports, setImports] = useState([]);
  const [activeImportId, setActiveImportId] = useState('');
  const [shifts, setShifts] = useState(emptyPage);
  const [summary, setSummary] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [creditRules, setCreditRules] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [view, setView] = useState('ALL');
  const [employeeCode, setEmployeeCode] = useState('');
  const [page, setPage] = useState(0);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [decisionShift, setDecisionShift] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const activeImport = imports.find((item) => item.id === activeImportId) || null;
  const isAdmin = authApi.getRole() === 'ADMIN';

  const loadBase = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [importPage, nextSummary, nextPolicies, nextCreditRules, incidentPage] = await Promise.all([
        api.listImports({ page: 0, size: 100, month }), api.summary(month), api.shiftPolicies(), api.workCreditRules(), api.incidents({ page: 0, size: 100 }),
      ]);
      const nextImports = importPage?.content || [];
      setImports(nextImports); setSummary(nextSummary); setPolicies(nextPolicies || []); setCreditRules(nextCreditRules || []); setIncidents(incidentPage?.content || []);
      setActiveImportId((current) => nextImports.some((item) => item.id === current) ? current : nextImports[0]?.id || '');
    } catch (requestError) { setError(apiErrorMessage(requestError, 'Không thể tải chấm công ca sản xuất.')); }
    finally { setLoading(false); }
  }, [month]);

  const loadShifts = useCallback(async () => {
    if (!activeImportId) { setShifts(emptyPage); return; }
    const params = { importId: activeImportId, page, size: 50, employeeCode: employeeCode.trim() || undefined };
    if (view === 'PRODUCTION_WORKER' || view === 'KCS') params.policyGroup = view;
    if (view === 'NEEDS_REVIEW' || view === 'CONFIRMED') params.status = view;
    if (view === 'INCIDENT') params.incidentOnly = true;
    try { setShifts(await api.shifts(params)); setSelected(new Set()); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể tải danh sách ca.')); }
  }, [activeImportId, employeeCode, page, view]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  const mutate = async (action, success, fallback) => {
    setWorking(true);
    try { await action(); toast.success(success); await loadBase(); await loadShifts(); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, fallback)); }
    finally { setWorking(false); }
  };

  const upload = () => mutate(async () => {
    for (const file of files) await api.upload(file, month);
    setFiles([]); const input = document.getElementById('production-attendance-files'); if (input) input.value = '';
  }, `Đã import ${files.length} file ca sản xuất.`, 'Không thể import file ca sản xuất.');

  const confirmImport = (item) => {
    if (!window.confirm(`Chốt file ${item.sourceFileName}? Sau đó file sẽ bị khóa.`)) return;
    mutate(() => api.confirmImport(item.id), 'Đã chốt file chấm công.', 'Không thể chốt vì còn ca cần kiểm tra.');
  };
  const reopen = (item) => {
    const reason = window.prompt('Nhập lý do mở khóa file đã chốt:'); if (!reason?.trim()) return;
    mutate(() => api.reopenImport(item.id, { reason: reason.trim(), rowVersion: item.rowVersion }), 'Đã mở khóa file để điều chỉnh.', 'Không thể mở khóa file.');
  };
  const bulkConfirm = () => {
    if (!selected.size) return toast.error('Chọn ít nhất một ca tự ghép.');
    const reason = window.prompt('Lý do xác nhận hàng loạt:'); if (!reason?.trim()) return;
    mutate(() => api.bulkConfirm({ shiftIds: [...selected], reason: reason.trim() }), `Đã xác nhận ${selected.size} ca.`, 'Không thể xác nhận hàng loạt.');
  };

  const selectableIds = useMemo(() => shifts.content.filter((item) => item.status === 'AUTO_MATCHED').map((item) => item.id), [shifts]);
  if (loading) return <HrPageShell><HrLoading label="Đang tải chấm công ca sản xuất..." /></HrPageShell>;
  if (error) return <HrPageShell><HrError message={error} onRetry={loadBase} /></HrPageShell>;

  return <HrPageShell>
    <SEOHead title="CFC Base | Chấm công ca sản xuất" url="https://cfcbooking.io.vn/manager/hr/attendance" />
    <HrPageHeader title="Chấm công" description="Import dấu chấm Time Attendance, ghép ca Công nhân/KCS, review và xuất bảng công từ dữ liệu đã chốt." actions={<Button type="button" variant="secondary" onClick={loadBase}><RefreshCw className="h-4 w-4" />Tải lại</Button>} />
    <AttendanceTabs onSelectMode={onSelectMode} />
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end gap-3"><label className="min-w-44 flex-1 text-sm font-medium text-gray-700">Tháng<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPage(0); }} className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3" /></label><Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}><Settings2 className="h-4 w-4" />Cấu hình</Button><Button type="button" variant="secondary" onClick={() => setIncidentOpen(true)}><AlertTriangle className="h-4 w-4" />Sự cố máy</Button>{summary?.confirmedImports > 0 && <Button type="button" onClick={async () => { try { downloadBlob(await api.exportSummary(month), `BANG_CONG_CA_SAN_XUAT_${month}.xlsx`); } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể xuất Excel.')); } }}><Download className="h-4 w-4" />Xuất Excel</Button>}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tổng nhân viên" value={summary?.totalEmployees || 0} /><Metric label="Tổng công đã chốt" value={work(summary?.totalWorkValue)} tone="green" /><Metric label="Ca đêm" value={summary?.nightShifts || 0} tone="blue" /><Metric label="Phụ cấp đêm" value={money(summary?.nightAllowanceAmount)} tone="amber" /></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="Ca sự cố" value={summary?.incidentShifts || 0} /><Metric label="Người miễn chấm" value={summary?.exemptedEmployees || 0} /><Metric label="Dòng trùng nguồn" value={summary?.duplicateSourceDays || 0} tone={summary?.duplicateSourceDays ? 'amber' : 'slate'} /></div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-5 w-5 text-blue-600" /><div><h2 className="font-semibold">Import Time Attendance</h2><p className="mt-1 text-xs text-gray-500">Có thể chọn nhiều file; mỗi file giữ nguyên G–J và đủ ngày.</p></div></div><input id="production-attendance-files" type="file" multiple accept=".xlsx,.xls,.xlsm" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-4 block w-full text-sm" /><Button type="button" className="mt-4 w-full" disabled={!files.length || working} onClick={upload}><FileSpreadsheet className="h-4 w-4" />{working ? 'Đang xử lý...' : `Import ${files.length || ''} file`}</Button></div>
    </section>

    <section className="mt-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Các file trong tháng</h2><p className="mt-1 text-xs text-gray-500">Chọn một file để review. Chỉ file đã chốt mới vào tổng hợp.</p></div><span className="text-sm text-gray-500">{imports.length} file</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{imports.map((item) => <ImportCard key={item.id} item={item} active={item.id === activeImportId} canReopen={isAdmin} onSelect={() => { setActiveImportId(item.id); setPage(0); }} onConfirm={() => confirmImport(item)} onRecalculate={() => mutate(() => api.recalculate(item.id), 'Đã tính lại từ dấu chấm gốc.', 'Không thể tính lại file.')} onReopen={() => reopen(item)} />)}{!imports.length && <HrEmpty title="Chưa có file ca sản xuất" description="Chọn tháng và import file Time Attendance ở phía trên." />}</div></section>

    {activeImport && <section className="mt-5 space-y-4"><div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2">{views.map(([key, label]) => <button key={key} type="button" onClick={() => { setView(key); setPage(0); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === key ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{label}</button>)}<input value={employeeCode} onChange={(event) => { setEmployeeCode(event.target.value.toUpperCase()); setPage(0); }} placeholder="Lọc mã nhân viên" className="h-10 min-w-44 flex-1 rounded-lg border border-gray-300 px-3 text-sm" />{selected.size > 0 && <Button type="button" size="sm" onClick={bulkConfirm}><CheckCircle2 className="h-4 w-4" />Xác nhận {selected.size} ca</Button>}</div></div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="hidden overflow-x-auto md:block"><table className="min-w-[1250px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-3"><input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))} onChange={(event) => setSelected(event.target.checked ? new Set(selectableIds) : new Set())} /></th><th className="px-3 py-3">Nhân viên</th><th className="px-3 py-3">Ngày</th><th className="px-3 py-3">Nhóm / ca</th><th className="px-3 py-3">Vào</th><th className="px-3 py-3">Ra</th><th className="px-3 py-3">Công</th><th className="px-3 py-3">Phụ cấp</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{shifts.content.map((item) => <tr key={item.id} className={item.status === 'NEEDS_REVIEW' ? 'bg-amber-50/60' : ''}><td className="px-3 py-3"><input type="checkbox" disabled={item.status !== 'AUTO_MATCHED'} checked={selected.has(item.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} /></td><td className="px-3 py-3"><b>{item.employeeCode}</b><p className="text-xs text-gray-500">{item.employeeName}</p></td><td className="px-3 py-3">{formatHrDate(item.workDate)}</td><td className="px-3 py-3">{policyLabel(item.policyGroup)}<p className="text-xs text-gray-500">{item.shiftCode || '—'}</p></td><td className="px-3 py-3">{time(item.checkInAt)}</td><td className="px-3 py-3">{time(item.checkOutAt)}</td><td className="px-3 py-3 font-semibold">{work(item.workValue)}</td><td className="px-3 py-3">{money(item.nightAllowanceAmount)}</td><td className="px-3 py-3"><HrStatusBadge status={item.status} /></td><td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" onClick={() => setDecisionShift(item)}><Eye className="h-4 w-4" />{activeImport.status === 'PREVIEWED' ? 'Review' : 'Chi tiết'}</Button></td></tr>)}</tbody></table></div><div className="divide-y divide-gray-100 md:hidden">{shifts.content.map((item) => <article key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><b>{item.employeeCode} · {item.employeeName}</b><p className="text-sm text-gray-500">{formatHrDate(item.workDate)} · {item.shiftCode || 'Chưa rõ ca'}</p></div><HrStatusBadge status={item.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p>Vào: {time(item.checkInAt)}</p><p>Ra: {time(item.checkOutAt)}</p><p>Công: <b>{work(item.workValue)}</b></p><p>Phụ cấp: {money(item.nightAllowanceAmount)}</p></div><Button type="button" size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setDecisionShift(item)}>{activeImport.status === 'PREVIEWED' ? 'Review chi tiết' : 'Xem chi tiết'}</Button></article>)}</div>{!shifts.content.length && <div className="p-6"><HrEmpty title="Không có ca phù hợp bộ lọc" /></div>}</div><HrPagination page={shifts.page || 0} totalPages={shifts.totalPages || 0} totalElements={shifts.totalElements || 0} onPageChange={setPage} />
    </section>}

    <ShiftDecisionDrawer shift={decisionShift} policies={policies} readOnly={activeImport?.status !== 'PREVIEWED'} onClose={() => setDecisionShift(null)} onSaved={() => { setDecisionShift(null); loadBase(); loadShifts(); }} />
    <ConfigurationDrawer open={settingsOpen} policies={policies} creditRules={creditRules} onClose={() => setSettingsOpen(false)} onRefresh={loadBase} />
    <IncidentDrawer open={incidentOpen} activeImport={activeImport} incidents={incidents} onClose={() => setIncidentOpen(false)} onRefresh={() => { loadBase(); loadShifts(); }} />
  </HrPageShell>;
}

import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  UserRound,
  XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Drawer } from '../components/overlays/Drawer.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, SelectInput, TextArea, TextInput } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { formatDateDisplay, initialsOf, movementTypeLabel } from '../lib/format.js';

const emptyMovement = {
  employeeId: '',
  type: 'INCREASE',
  effectiveDate: '',
  reason: '',
  decisionNo: '',
  decisionDate: ''
};

const movementType = (movement) => movement.type || movement.movementType || '';
const movementEmployee = (movement, employees) => {
  const nested = movement.employee && typeof movement.employee === 'object'
    ? movement.employee
    : null;
  const employeeId = movement.employeeId || nested?.id;
  const employee = employees.find((item) => String(item.id) === String(employeeId));
  return {
    id: employeeId,
    code: movement.code || movement.employeeCode || nested?.code || employee?.code || '',
    fullName: movement.fullName || movement.employeeName || nested?.fullName || employee?.fullName || ''
  };
};

export function MovementsPage({ navigate }) {
  const {
    movements,
    employees,
    loading,
    error,
    reload,
    addMovementDraft,
    previewMovement,
    confirmMovement,
    cancelMovement
  } = useAppData();
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyMovement);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const eligibleEmployees = useMemo(
    () => employees.filter((employee) =>
      form.type === 'DECREASE' ? employee.status === 'ACTIVE' : employee.status === 'DRAFT'
    ),
    [employees, form.type]
  );

  const visibleMovements = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return movements.filter((movement) => {
      const employee = movementEmployee(movement, employees);
      const searchable = `${employee.code} ${employee.fullName} ${movement.reason || ''} ${movement.decisionNo || ''}`
        .toLocaleLowerCase('vi');
      return (!normalized || searchable.includes(normalized))
        && (!type || movementType(movement) === type)
        && (!status || movement.status === status);
    });
  }, [employees, keyword, movements, status, type]);

  const openDrawer = () => {
    setForm(emptyMovement);
    setFormError('');
    setDrawerOpen(true);
  };

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'type' ? { employeeId: '' } : null)
    }));
    setFormError('');
  };

  const saveDraft = async () => {
    if (!form.employeeId || !form.effectiveDate || !form.reason.trim()) {
      setFormError('Vui lòng chọn nhân sự, ngày hiệu lực và nhập lý do biến động.');
      return;
    }
    const employee = employees.find((item) => String(item.id) === String(form.employeeId));
    setSaving(true);
    try {
      await addMovementDraft({
        ...form,
        employeeCode: employee?.code || '',
        employeeName: employee?.fullName || '',
        movementType: form.type
      });
      setDrawerOpen(false);
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể lưu bản nháp biến động.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDraft = async (movement) => {
    setBusyId(movement.id);
    try {
      const preview = await previewMovement(movement.id);
      const before = preview?.activeCountBefore ?? preview?.active_count_before ?? preview?.before;
      const after = preview?.activeCountAfter ?? preview?.active_count_after ?? preview?.after;
      const effectiveDate = formatDateDisplay(preview?.effectiveDate || movement.effectiveDate);
      const impact = Number.isFinite(Number(before)) && Number.isFinite(Number(after))
        ? `Số nhân sự đang làm việc: ${Number(before).toLocaleString('vi-VN')} → ${Number(after).toLocaleString('vi-VN')}.`
        : 'Danh sách tháng sẽ được cập nhật theo ảnh hưởng đã xem trước.';
      if (!globalThis.confirm(`Xác nhận biến động hiệu lực ngày ${effectiveDate}?\n${impact}`)) return;
      await confirmMovement(movement.id);
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể xác nhận biến động.');
    } finally {
      setBusyId('');
    }
  };

  const cancelDraft = async (movement) => {
    const reason = globalThis.prompt('Nhập lý do hủy bản nháp biến động:');
    if (reason === null) return;
    if (!reason.trim()) {
      setFormError('Vui lòng nhập lý do hủy bản nháp.');
      return;
    }
    setBusyId(movement.id);
    try {
      await cancelMovement(movement.id, reason.trim());
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể hủy bản nháp biến động.');
    } finally {
      setBusyId('');
    }
  };

  const draftActions = (movement) => movement.status === 'DRAFT' ? (
    <span className="movement-actions">
      <Button size="sm" onClick={() => confirmDraft(movement)} disabled={Boolean(busyId)}><CheckCircle2 />Xác nhận</Button>
      <Button size="sm" variant="neutral" onClick={() => cancelDraft(movement)} disabled={Boolean(busyId)}><XCircle />Hủy</Button>
    </span>
  ) : <span className="readonly-label">Đã xử lý</span>;

  return (
    <section className="movements-page">
      <PageHeader
        title="Tăng / Giảm nhân sự"
        description="Ghi nhận biến động theo ngày hiệu lực. Bản ghi mới luôn được lưu nháp để kiểm tra trước khi xác nhận."
        actions={(
          <>
            <Button variant="secondary" onClick={() => navigate('/employees/new')}>
              <UserRound aria-hidden="true" />Tạo hồ sơ nhân sự
            </Button>
            <Button onClick={openDrawer}>
              <Plus aria-hidden="true" />Ghi nhận biến động
            </Button>
          </>
        )}
      />

      <div className="movement-summary">
        <article className="surface movement-summary__item">
          <span className="movement-summary__icon movement-summary__icon--up"><ArrowUp /></span>
          <span><small>Tăng nhân sự</small><strong>{movements.filter((item) => movementType(item) === 'INCREASE').length}</strong></span>
        </article>
        <article className="surface movement-summary__item">
          <span className="movement-summary__icon movement-summary__icon--down"><ArrowDown /></span>
          <span><small>Giảm nhân sự</small><strong>{movements.filter((item) => movementType(item) === 'DECREASE').length}</strong></span>
        </article>
        <article className="surface movement-summary__item">
          <span className="movement-summary__icon movement-summary__icon--draft"><FileText /></span>
          <span><small>Bản nháp cần xử lý</small><strong>{movements.filter((item) => item.status === 'DRAFT').length}</strong></span>
        </article>
      </div>

      <div className="movement-filter surface">
        <label className="search-control">
          <Search aria-hidden="true" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã, tên, lý do hoặc số quyết định" />
        </label>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Tất cả loại biến động</option>
          <option value="INCREASE">Tăng nhân sự</option>
          <option value="DECREASE">Giảm nhân sự</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <Button variant="ghost" onClick={() => { setKeyword(''); setType(''); setStatus(''); }}>Xóa lọc</Button>
      </div>

      {error ? (
        <div className="surface"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <div className="movement-ledger surface">
          <div className="movement-table-wrap">
            <table className="data-table movement-table">
              <thead>
                <tr><th>Nhân sự</th><th>Loại</th><th>Ngày hiệu lực</th><th>Lý do</th><th>Quyết định</th><th>Trạng thái</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="7"><LoadingState label="Đang tải biến động nhân sự..." /></td></tr> : visibleMovements.map((movement) => {
                  const employee = movementEmployee(movement, employees);
                  const currentType = movementType(movement);
                  return (
                    <tr key={movement.id}>
                      <td><div className="employee-identity"><span className="avatar">{initialsOf(employee.fullName)}</span><span><strong>{employee.fullName || '—'}</strong><small>{employee.code || '—'}</small></span></div></td>
                      <td><span className={`movement-kind movement-kind--${currentType === 'DECREASE' ? 'down' : 'up'}`}>{currentType === 'DECREASE' ? <ArrowDown /> : <ArrowUp />}{movementTypeLabel(currentType)}</span></td>
                      <td>{formatDateDisplay(movement.effectiveDate)}</td>
                      <td>{movement.reason || '—'}</td>
                      <td><strong>{movement.decisionNo || '—'}</strong><small>{formatDateDisplay(movement.decisionDate)}</small></td>
                      <td><StatusBadge status={movement.status} /></td>
                      <td>{draftActions(movement)}</td>
                    </tr>
                  );
                })}
                {!loading && !visibleMovements.length ? (
                  <tr><td colSpan="7"><EmptyState title="Chưa có biến động phù hợp" description="Điều chỉnh bộ lọc hoặc ghi nhận một biến động mới." action={<Button onClick={openDrawer}><Plus />Ghi nhận biến động</Button>} /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="movement-mobile-list">
            {loading ? <LoadingState label="Đang tải biến động..." /> : visibleMovements.map((movement) => {
              const employee = movementEmployee(movement, employees);
              const currentType = movementType(movement);
              return (
                <article key={movement.id} className="movement-mobile-card">
                  <div className="movement-mobile-card__top">
                    <span className="avatar">{initialsOf(employee.fullName)}</span>
                    <span><strong>{employee.fullName || '—'}</strong><small>{employee.code || '—'}</small></span>
                    <StatusBadge status={movement.status} />
                  </div>
                  <div className="movement-mobile-card__meta">
                    <span className={`movement-kind movement-kind--${currentType === 'DECREASE' ? 'down' : 'up'}`}>{currentType === 'DECREASE' ? <ArrowDown /> : <ArrowUp />}{movementTypeLabel(currentType)}</span>
                    <span><CalendarDays />{formatDateDisplay(movement.effectiveDate)}</span>
                  </div>
                  <p>{movement.reason || 'Chưa có lý do'}</p>
                  {draftActions(movement)}
                </article>
              );
            })}
            {!loading && !visibleMovements.length ? <EmptyState title="Chưa có biến động phù hợp" description="Điều chỉnh bộ lọc hoặc ghi nhận một biến động mới." /> : null}
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        title="Ghi nhận biến động"
        width="520px"
        onClose={() => !saving && setDrawerOpen(false)}
        footer={(
          <>
            <Button variant="neutral" onClick={() => setDrawerOpen(false)} disabled={saving}>Hủy</Button>
            <Button onClick={saveDraft} disabled={saving}><FileText />{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</Button>
          </>
        )}
      >
        <div className="drawer-intro">
          <span><ArrowDownUp /></span>
          <div><strong>Chỉ tạo bản nháp</strong><p>Biến động chưa tác động tới danh sách tháng cho đến khi được xác nhận bởi quy trình nghiệp vụ.</p></div>
        </div>
        <div className="drawer-form">
          <Field label="Loại biến động" required>
            <SelectInput value={form.type} onChange={update('type')}>
              <option value="INCREASE">Tăng nhân sự</option>
              <option value="DECREASE">Giảm nhân sự</option>
            </SelectInput>
          </Field>
          <Field label="Nhân sự" required>
            <SelectInput value={form.employeeId} onChange={update('employeeId')}>
              <option value="">Chọn nhân sự</option>
              {eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.code ? `${employee.code} · ` : ''}{employee.fullName}</option>)}
            </SelectInput>
            {!eligibleEmployees.length ? <span className="field-hint">Không có nhân sự phù hợp với loại biến động đã chọn.</span> : null}
          </Field>
          <Field label="Ngày hiệu lực" required><TextInput type="date" value={form.effectiveDate} onChange={update('effectiveDate')} /></Field>
          <Field label="Lý do biến động" required><TextArea value={form.reason} onChange={update('reason')} placeholder="Nhập lý do tăng, giảm hoặc tái tuyển dụng" /></Field>
          <div className="drawer-form__split">
            <Field label="Số quyết định"><TextInput value={form.decisionNo} onChange={update('decisionNo')} placeholder="VD: 15/QĐ-CFC-HCNS" /></Field>
            <Field label="Ngày quyết định"><TextInput type="date" value={form.decisionDate} onChange={update('decisionDate')} /></Field>
          </div>
          {formError ? <p className="form-submit-error" role="alert">{formError}</p> : null}
        </div>
      </Drawer>
    </section>
  );
}

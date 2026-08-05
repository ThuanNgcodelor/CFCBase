import {
  BriefcaseBusiness,
  ContactRound,
  IdCard,
  Save,
  UserRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { hrRpc } from '../api/rpc.js';
import { Button } from '../components/ui/Button.jsx';
import { Field, SelectInput, TextInput } from '../components/ui/FormControls.jsx';
import { LongFormSection } from '../components/ui/LongFormSection.jsx';
import { ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { catalogNames, normalizeEmployee, toDateInput } from '../lib/format.js';

const emptyForm = {
  code: '',
  fullName: '',
  gender: '',
  dob: '',
  phone: '',
  email: '',
  cccd: '',
  citizenIssuedDate: '',
  citizenIssuedPlace: '',
  department: '',
  position: '',
  workingCondition: 'Bình thường',
  joinDate: '',
  leaveAccrualStartDate: '',
  contractType: '',
  status: 'DRAFT'
};

export function EmployeeFormPage({ id, navigate }) {
  const { employees, catalogs, addEmployeeDraft, updateEmployee } = useAppData();
  const existing = useMemo(
    () => employees.find((employee) => String(employee.id) === String(id)),
    [employees, id]
  );
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(Boolean(id));
  const [detailError, setDetailError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState({ general: true, identity: true, work: true, contact: true });
  const departments = useMemo(() => [...new Set([
    ...catalogNames(catalogs.departments),
    existing?.department
  ].filter(Boolean))], [catalogs.departments, existing?.department]);
  const positions = useMemo(() => [...new Set([
    ...catalogNames(catalogs.positions),
    existing?.position
  ].filter(Boolean))], [catalogs.positions, existing?.position]);
  const conditions = useMemo(() => [...new Set([
    ...catalogNames(catalogs.conditions),
    existing?.workingCondition
  ].filter(Boolean))], [catalogs.conditions, existing?.workingCondition]);

  useEffect(() => {
    if (!id) {
      setForm(emptyForm);
      setDetailLoading(false);
      return undefined;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    hrRpc.getEmployee(id)
      .then((result) => {
        if (!active) return;
        const detail = normalizeEmployee(result);
        setForm({
          ...emptyForm,
          ...detail,
          dob: toDateInput(detail.dob),
          citizenIssuedDate: toDateInput(detail.citizenIssuedDate),
          joinDate: toDateInput(detail.joinDate),
          leaveAccrualStartDate: toDateInput(detail.leaveAccrualStartDate)
        });
      })
      .catch((requestError) => {
        if (active) setDetailError(requestError.message || 'Không thể tải hồ sơ để chỉnh sửa.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    globalThis.addEventListener('beforeunload', beforeUnload);
    return () => globalThis.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.code.trim()) next.code = 'Vui lòng nhập mã nhân sự.';
    if (!form.fullName.trim()) next.fullName = 'Vui lòng nhập họ và tên.';
    if (!form.gender) next.gender = 'Vui lòng chọn giới tính.';
    if (!form.phone.trim()) next.phone = 'Vui lòng nhập số điện thoại.';
    if (!form.department) next.department = 'Vui lòng chọn phòng ban.';
    if (!form.position) next.position = 'Vui lòng nhập chức vụ.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = id
        ? await updateEmployee(id, form)
        : await addEmployeeDraft(form);
      setDirty(false);
      navigate(`/employees/${saved.id}`, { replace: true });
    } catch (error) {
      setErrors({ submit: error.message || 'Không thể lưu hồ sơ.' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !globalThis.confirm('Thông tin chưa được lưu. Bạn có muốn rời trang?')) return;
    navigate(id ? `/employees/${id}` : '/employees');
  };

  if (detailLoading) return <section className="surface"><LoadingState label="Đang tải hồ sơ để chỉnh sửa..." /></section>;
  if (detailError) return <section className="surface"><ErrorState message={detailError} onRetry={() => navigate(`/employees/${id}`, { replace: true })} /></section>;

  return (
    <form className="long-form-page employee-form-page" onSubmit={submit}>
      <header className="long-form-page__heading">
        <h1>{id ? 'Chỉnh sửa hồ sơ nhân sự' : 'Thêm hồ sơ nhân sự'}</h1>
        <p>{id ? 'Cập nhật thông tin hồ sơ nháp.' : 'Tạo hồ sơ nháp trước khi xác nhận Tăng nhân sự.'}</p>
      </header>

      <div className="long-form-progress"><span style={{ width: '100%' }} /><b>4/4 mục</b></div>

      <LongFormSection icon={UserRound} title="Thông tin nhân sự" open={sections.general} onToggle={() => setSections((value) => ({ ...value, general: !value.general }))}>
        <div className="form-grid">
          <Field label="Mã nhân sự" required error={errors.code}>
            <TextInput value={form.code} onChange={update('code')} placeholder="NV-YYYYMMDD-XXXX" />
          </Field>
          <Field label="Họ và tên" required error={errors.fullName}>
            <TextInput value={form.fullName} onChange={update('fullName')} placeholder="Nhập họ và tên" />
          </Field>
          <Field label="Giới tính" required error={errors.gender}>
            <SelectInput value={form.gender} onChange={update('gender')}>
              <option value="">Chọn giới tính</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </SelectInput>
          </Field>
          <Field label="Ngày sinh">
            <TextInput type="date" value={form.dob} onChange={update('dob')} />
          </Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={IdCard} title="CCCD / định danh" open={sections.identity} onToggle={() => setSections((value) => ({ ...value, identity: !value.identity }))}>
        <div className="form-grid">
          <Field label="Số CCCD">
            <TextInput value={form.cccd} onChange={update('cccd')} placeholder="Nhập số CCCD" />
          </Field>
          <Field label="Ngày cấp">
            <TextInput type="date" value={form.citizenIssuedDate} onChange={update('citizenIssuedDate')} />
          </Field>
          <Field label="Nơi cấp" className="form-field--full">
            <TextInput value={form.citizenIssuedPlace} onChange={update('citizenIssuedPlace')} placeholder="Nhập nơi cấp" />
          </Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={BriefcaseBusiness} title="Công việc" open={sections.work} onToggle={() => setSections((value) => ({ ...value, work: !value.work }))}>
        <div className="form-grid">
          <Field label="Phòng ban" required error={errors.department}>
            <SelectInput value={form.department} onChange={update('department')}>
              <option value="">Chọn phòng ban</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </SelectInput>
          </Field>
          <Field label="Chức vụ" required error={errors.position}>
            <SelectInput value={form.position} onChange={update('position')}>
              <option value="">Chọn chức vụ</option>
              {positions.map((position) => <option key={position} value={position}>{position}</option>)}
            </SelectInput>
          </Field>
          <Field label="Điều kiện lao động">
            <SelectInput value={form.workingCondition} onChange={update('workingCondition')}>
              <option value="">Chọn điều kiện lao động</option>
              {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
            </SelectInput>
          </Field>
          <Field label="Ngày vào làm">
            <TextInput type="date" value={form.joinDate} onChange={update('joinDate')} />
          </Field>
          <Field label="Mốc tính phép">
            <TextInput type="date" value={form.leaveAccrualStartDate} onChange={update('leaveAccrualStartDate')} />
          </Field>
          <Field label="Loại hợp đồng" className="form-field--full">
            <SelectInput value={form.contractType} onChange={update('contractType')}>
              <option value="">Chọn loại hợp đồng</option>
              <option>Hợp đồng xác định thời hạn</option>
              <option>Hợp đồng không xác định thời hạn</option>
            </SelectInput>
          </Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={ContactRound} title="Liên hệ" open={sections.contact} onToggle={() => setSections((value) => ({ ...value, contact: !value.contact }))}>
        <div className="form-grid">
          <Field label="Số điện thoại" required error={errors.phone}>
            <TextInput value={form.phone} onChange={update('phone')} placeholder="Nhập số điện thoại" />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={update('email')} placeholder="Nhập email" />
          </Field>
        </div>
      </LongFormSection>

      {errors.submit ? <p className="form-submit-error" role="alert">{errors.submit}</p> : null}

      <footer className="long-form-actions">
        <Button type="button" variant="neutral" size="lg" onClick={cancel}>Hủy</Button>
        <Button type="submit" size="lg" disabled={saving}>
          <Save aria-hidden="true" />{saving ? 'Đang lưu...' : id ? 'Lưu thay đổi' : 'Lưu hồ sơ nháp'}
        </Button>
      </footer>
    </form>
  );
}

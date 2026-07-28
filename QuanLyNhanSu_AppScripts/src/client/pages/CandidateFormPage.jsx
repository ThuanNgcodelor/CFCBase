import {
  BriefcaseBusiness,
  IdCard,
  Save,
  UserRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { Field, SelectInput, TextArea, TextInput } from '../components/ui/FormControls.jsx';
import { LongFormSection } from '../components/ui/LongFormSection.jsx';
import { ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { useAppData } from '../context/AppDataContext.jsx';

const emptyCandidate = {
  candidateCode: '',
  fullName: '',
  candidateTitle: '',
  gender: '',
  dateOfBirth: '',
  birthPlace: '',
  nationality: 'Việt Nam',
  phone: '',
  email: '',
  citizenId: '',
  citizenIdIssuedDate: '',
  citizenIdIssuedPlace: '',
  permanentAddress: '',
  jobTemplateId: '',
  department: '',
  position: '',
  probationStartDate: '',
  probationEndDate: '',
  baseSalary: '',
  jobDescription: '',
  status: 'DRAFT'
};

export function CandidateFormPage({ id, navigate }) {
  const { candidates, jobTemplates, loading, addCandidate, updateCandidate } = useAppData();
  const existing = useMemo(
    () => candidates.find((candidate) => String(candidate.id) === String(id)),
    [candidates, id]
  );
  const availableTemplates = useMemo(
    () => jobTemplates.filter((template) =>
      template.status === 'ACTIVE' || String(template.id) === String(existing?.jobTemplateId)
    ),
    [existing?.jobTemplateId, jobTemplates]
  );
  const [form, setForm] = useState(() => existing ? { ...emptyCandidate, ...existing } : emptyCandidate);
  const [sections, setSections] = useState(() => ({
    candidate: true,
    identity: globalThis.innerWidth > 899,
    work: globalThis.innerWidth > 899
  }));
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && existing && !dirty) {
      setForm({ ...emptyCandidate, ...existing });
    }
  }, [dirty, existing, id]);

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
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const selectTemplate = (event) => {
    const jobTemplateId = event.target.value;
    const template = availableTemplates.find((item) => item.id === jobTemplateId);
    setForm((current) => ({
      ...current,
      jobTemplateId,
      department: template?.department || current.department,
      position: template?.position || current.position,
      baseSalary: template?.baseSalary || current.baseSalary,
      jobDescription: template?.description || current.jobDescription
    }));
    setDirty(true);
  };

  const validate = () => {
    const next = {};
    ['fullName', 'candidateTitle', 'gender', 'dateOfBirth', 'phone', 'email', 'department', 'position', 'probationStartDate', 'probationEndDate'].forEach((field) => {
      if (!String(form[field] || '').trim()) next[field] = 'Thông tin này là bắt buộc.';
    });
    setErrors(next);
    if (next.candidateTitle || next.fullName || next.gender || next.dateOfBirth || next.phone || next.email) {
      setSections((current) => ({ ...current, candidate: true }));
    }
    if (next.department || next.position) setSections((current) => ({ ...current, work: true }));
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (existing) await updateCandidate(existing.id, form);
      else await addCandidate(form);
      setDirty(false);
      navigate('/probation', { replace: true });
    } catch (error) {
      setErrors({ submit: error.message || 'Không thể lưu ứng viên.' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !globalThis.confirm('Thông tin chưa được lưu. Bạn có muốn rời trang?')) return;
    navigate('/probation');
  };

  if (id && loading && !existing) {
    return <section className="surface"><LoadingState label="Đang tải hồ sơ ứng viên..." /></section>;
  }
  if (id && !loading && !existing) {
    return <section className="surface"><ErrorState message="Không tìm thấy hồ sơ ứng viên thử việc." onRetry={() => navigate('/probation')} /></section>;
  }
  if (existing && existing.status !== 'DRAFT') {
    return <section className="surface"><ErrorState message="Chỉ hồ sơ ứng viên ở trạng thái Bản nháp mới được chỉnh sửa." onRetry={() => navigate('/probation')} /></section>;
  }

  return (
    <form className="long-form-page candidate-form-page" onSubmit={submit}>
      <header className="long-form-page__heading">
        <h1>{existing ? 'Chỉnh sửa ứng viên thử việc' : 'Thêm ứng viên thử việc'}</h1>
        <p>{existing ? 'Cập nhật thông tin hồ sơ ứng viên thử việc.' : 'Nhập thông tin để tạo hồ sơ ứng viên thử việc.'}</p>
      </header>

      <div className="candidate-progress"><span><i style={{ width: sections.work ? '100%' : sections.identity ? '66%' : '33%' }} /></span><b>{sections.work ? '3/3' : sections.identity ? '2/3' : '1/3'} mục</b></div>

      <LongFormSection icon={UserRound} title="Thông tin ứng viên" open={sections.candidate} onToggle={() => setSections((value) => ({ ...value, candidate: !value.candidate }))}>
        <div className="form-grid">
          <Field label="Mã ứng viên (tự động)">
            <TextInput value={form.candidateCode} disabled placeholder="TV-YYMMDDHHMMSS" />
          </Field>
          <Field label="Họ và tên" required error={errors.fullName}>
            <TextInput value={form.fullName} onChange={update('fullName')} placeholder="Nhập họ và tên" />
          </Field>
          <Field label="Xưng hô" required error={errors.candidateTitle}>
            <SelectInput value={form.candidateTitle} onChange={update('candidateTitle')}>
              <option value="">Chọn xưng hô</option><option>Ông</option><option>Bà</option>
            </SelectInput>
          </Field>
          <Field label="Giới tính" required error={errors.gender}>
            <SelectInput value={form.gender} onChange={update('gender')}>
              <option value="">Chọn giới tính</option><option>Nam</option><option>Nữ</option><option>Khác</option>
            </SelectInput>
          </Field>
          <Field label="Ngày sinh" required error={errors.dateOfBirth}>
            <TextInput type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} />
          </Field>
          <Field label="Nơi sinh">
            <TextInput value={form.birthPlace} onChange={update('birthPlace')} placeholder="Nhập nơi sinh" />
          </Field>
          <Field label="Quốc tịch">
            <TextInput value={form.nationality} onChange={update('nationality')} placeholder="Việt Nam" />
          </Field>
          <Field label="Số điện thoại" required error={errors.phone}>
            <TextInput value={form.phone} onChange={update('phone')} placeholder="Nhập số điện thoại" />
          </Field>
          <Field label="Email" required error={errors.email} className="form-field--full">
            <TextInput type="email" value={form.email} onChange={update('email')} placeholder="Nhập email" />
          </Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={IdCard} title="CCCD / định danh" open={sections.identity} onToggle={() => setSections((value) => ({ ...value, identity: !value.identity }))}>
        <div className="form-grid">
          <Field label="Số CCCD"><TextInput value={form.citizenId} onChange={update('citizenId')} placeholder="Nhập số CCCD" /></Field>
          <Field label="Ngày cấp"><TextInput type="date" value={form.citizenIdIssuedDate} onChange={update('citizenIdIssuedDate')} /></Field>
          <Field label="Nơi cấp" className="form-field--full"><TextInput value={form.citizenIdIssuedPlace} onChange={update('citizenIdIssuedPlace')} placeholder="Nhập nơi cấp" /></Field>
          <Field label="Địa chỉ thường trú" className="form-field--full"><TextInput value={form.permanentAddress} onChange={update('permanentAddress')} placeholder="Nhập địa chỉ" /></Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={BriefcaseBusiness} title="Công việc thử việc" open={sections.work} onToggle={() => setSections((value) => ({ ...value, work: !value.work }))}>
        <div className="form-grid">
          <Field label="Mẫu công việc">
            <SelectInput value={form.jobTemplateId} onChange={selectTemplate}>
              <option value="">Chọn mẫu công việc</option>
              {availableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Phòng ban" required error={errors.department}><TextInput value={form.department} onChange={update('department')} /></Field>
          <Field label="Chức vụ" required error={errors.position}><TextInput value={form.position} onChange={update('position')} /></Field>
          <Field label="Mức lương thử việc"><TextInput type="number" value={form.baseSalary} onChange={update('baseSalary')} placeholder="0" /></Field>
          <Field label="Ngày bắt đầu" required error={errors.probationStartDate}><TextInput type="date" value={form.probationStartDate} onChange={update('probationStartDate')} /></Field>
          <Field label="Ngày kết thúc" required error={errors.probationEndDate}><TextInput type="date" value={form.probationEndDate} onChange={update('probationEndDate')} /></Field>
          <Field label="Mô tả công việc" className="form-field--full"><TextArea value={form.jobDescription} onChange={update('jobDescription')} placeholder="Nhập mô tả công việc thử việc" /></Field>
        </div>
      </LongFormSection>

      {errors.submit ? <p className="form-submit-error" role="alert">{errors.submit}</p> : null}

      <footer className="long-form-actions">
        <Button type="button" variant="neutral" size="lg" onClick={cancel}>Hủy</Button>
        <Button type="submit" size="lg" disabled={saving}><Save />{saving ? 'Đang lưu...' : existing ? 'Lưu thay đổi' : 'Thêm ứng viên'}</Button>
      </footer>
    </form>
  );
}

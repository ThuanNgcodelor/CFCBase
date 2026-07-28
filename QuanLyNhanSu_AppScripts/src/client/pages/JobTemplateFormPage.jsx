import { BriefcaseBusiness, FileText, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { Field, SelectInput, TextArea, TextInput } from '../components/ui/FormControls.jsx';
import { LongFormSection } from '../components/ui/LongFormSection.jsx';
import { ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { catalogNames } from '../lib/format.js';

const emptyTemplate = {
  code: '',
  name: '',
  department: '',
  position: '',
  baseSalary: '',
  description: '',
  probationContractType: 'Xác định thời hạn 02 tháng',
  salaryNote: 'Lương thử việc bằng 85% lương chính thức.',
  departmentRuleNote: 'Theo nội quy, quy chế và sự phân công của Công ty.',
  status: 'DRAFT'
};

export function JobTemplateFormPage({ id, navigate }) {
  const { jobTemplates, catalogs, loading, saveJobTemplate } = useAppData();
  const existing = useMemo(
    () => jobTemplates.find((template) => String(template.id) === String(id)),
    [jobTemplates, id]
  );
  const [form, setForm] = useState(() => existing ? { ...emptyTemplate, ...existing } : emptyTemplate);
  const [sections, setSections] = useState({ general: true, work: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const departments = useMemo(() => [...new Set([
    ...catalogNames(catalogs.departments),
    existing?.department
  ].filter(Boolean))], [catalogs.departments, existing?.department]);
  const positions = useMemo(() => [...new Set([
    ...catalogNames(catalogs.positions),
    existing?.position
  ].filter(Boolean))], [catalogs.positions, existing?.position]);

  useEffect(() => {
    if (id && existing) setForm({ ...emptyTemplate, ...existing });
  }, [existing, id]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.description.trim()
      || !String(form.baseSalary).trim() || !form.departmentRuleNote.trim()) {
      setError('Vui lòng nhập đủ mã, tên, lương, mô tả công việc và nội quy áp dụng.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveJobTemplate(existing?.id, form);
      navigate('/probation/templates', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Không thể lưu mẫu công việc.');
    } finally {
      setSaving(false);
    }
  };

  if (id && loading && !existing) {
    return <section className="surface"><LoadingState label="Đang tải mẫu công việc..." /></section>;
  }
  if (id && !loading && !existing) {
    return <section className="surface"><ErrorState message="Không tìm thấy mẫu công việc thử việc." onRetry={() => navigate('/probation/templates')} /></section>;
  }
  if (existing && existing.status !== 'DRAFT') {
    return <section className="surface"><ErrorState message="Chỉ mẫu công việc ở trạng thái Bản nháp mới được chỉnh sửa." onRetry={() => navigate('/probation/templates')} /></section>;
  }

  return (
    <form className="long-form-page job-template-form-page" onSubmit={submit}>
      <header className="long-form-page__heading">
        <h1>{existing ? 'Chỉnh sửa mẫu công việc' : 'Thêm mẫu công việc thử việc'}</h1>
        <p>Mẫu giúp điền nhanh phòng ban, chức vụ, lương và nội dung công việc cho ứng viên.</p>
      </header>

      <LongFormSection icon={FileText} title="Thông tin mẫu" open={sections.general} onToggle={() => setSections((value) => ({ ...value, general: !value.general }))}>
        <div className="form-grid">
          <Field label="Mã mẫu" required><TextInput value={form.code} onChange={update('code')} placeholder="TV-XXXX" /></Field>
          <Field label="Tên mẫu" required><TextInput value={form.name} onChange={update('name')} placeholder="Nhập tên mẫu công việc" /></Field>
          <Field label="Trạng thái" className="form-field--full">
            <SelectInput value={form.status} disabled><option value="DRAFT">Bản nháp</option></SelectInput>
          </Field>
        </div>
      </LongFormSection>

      <LongFormSection icon={BriefcaseBusiness} title="Nội dung công việc" open={sections.work} onToggle={() => setSections((value) => ({ ...value, work: !value.work }))}>
        <div className="form-grid">
          <Field label="Phòng ban">
            <SelectInput value={form.department} onChange={update('department')}>
              <option value="">Chọn phòng ban</option>
              {departments.map((department) => <option key={department}>{department}</option>)}
            </SelectInput>
          </Field>
          <Field label="Chức vụ">
            <SelectInput value={form.position} onChange={update('position')}>
              <option value="">Chọn chức vụ</option>
              {positions.map((position) => <option key={position}>{position}</option>)}
            </SelectInput>
          </Field>
          <Field label="Lương thử việc"><TextInput type="number" value={form.baseSalary} onChange={update('baseSalary')} /></Field>
          <Field label="Loại hợp đồng thử việc">
            <TextInput value={form.probationContractType} onChange={update('probationContractType')} />
          </Field>
          <Field label="Ghi chú lương"><TextInput value={form.salaryNote} onChange={update('salaryNote')} /></Field>
          <Field label="Mô tả công việc" className="form-field--full"><TextArea value={form.description} onChange={update('description')} /></Field>
          <Field label="Nội quy / quy định áp dụng" className="form-field--full">
            <TextArea value={form.departmentRuleNote} onChange={update('departmentRuleNote')} />
          </Field>
        </div>
      </LongFormSection>

      {error ? <p className="form-submit-error" role="alert">{error}</p> : null}
      <footer className="long-form-actions">
        <Button type="button" variant="neutral" size="lg" onClick={() => navigate('/probation/templates')}>Hủy</Button>
        <Button type="submit" size="lg" disabled={saving}><Save />{saving ? 'Đang lưu...' : 'Lưu mẫu công việc'}</Button>
      </footer>
    </form>
  );
}

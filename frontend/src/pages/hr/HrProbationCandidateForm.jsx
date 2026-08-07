import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  BriefcaseBusiness,
  ClipboardCheck,
  IdCard,
  Save,
  UserRound,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import {
  HrCatalogSelect,
  HrIssuingAuthoritySelect,
  HrSearchableCatalogSelect,
} from '../../components/hr/HrFormControls';
import { HrError, HrLoading, HrPageHeader, HrPageShell } from '../../components/hr/HrUi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { hrProbationApi } from '../../api/hrProbationApi';
import { apiErrorMessage } from '../../utils/hr';

const INPUT_CLASS = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:h-10 sm:text-sm';
const TEXTAREA_CLASS = 'min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';
const CANDIDATE_LIST_PATH = '/manager/hr/probation';

const EMPTY_CANDIDATE_FORM = {
  candidateCode: '',
  fullName: '',
  candidateTitle: '',
  gender: 'UNKNOWN',
  dateOfBirth: '',
  birthPlace: '',
  nationality: 'Việt Nam',
  citizenId: '',
  citizenIdIssuedDate: '',
  citizenIdIssuedPlace: '',
  permanentAddress: '',
  phone: '',
  email: '',
  departmentId: '',
  positionId: '',
  workingConditionId: '',
  jobTemplateId: '',
  probationContractType: 'Xác định thời hạn 02 tháng',
  probationStartDate: '',
  probationEndDate: '',
  baseSalary: '',
  salaryNote: '',
  jobDescription: '',
  departmentRuleNote: '',
  rowVersion: null,
};

function refId(value) {
  return value?.id || '';
}

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function moneyValue(value) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function candidatePayload(form) {
  return {
    candidateCode: nullableText(form.candidateCode),
    fullName: form.fullName.trim(),
    candidateTitle: nullableText(form.candidateTitle),
    gender: form.gender || 'UNKNOWN',
    dateOfBirth: form.dateOfBirth || null,
    birthPlace: nullableText(form.birthPlace),
    nationality: nullableText(form.nationality),
    citizenId: nullableText(form.citizenId),
    citizenIdIssuedDate: form.citizenIdIssuedDate || null,
    citizenIdIssuedPlace: nullableText(form.citizenIdIssuedPlace),
    permanentAddress: nullableText(form.permanentAddress),
    phone: nullableText(form.phone),
    email: nullableText(form.email),
    departmentId: form.departmentId || null,
    positionId: form.positionId || null,
    workingConditionId: form.workingConditionId || null,
    jobTemplateId: form.jobTemplateId || null,
    probationContractType: nullableText(form.probationContractType),
    probationStartDate: form.probationStartDate || null,
    probationEndDate: form.probationEndDate || null,
    baseSalary: nullableNumber(form.baseSalary),
    salaryNote: nullableText(form.salaryNote),
    jobDescription: nullableText(form.jobDescription),
    departmentRuleNote: nullableText(form.departmentRuleNote),
  };
}

function formFromCandidate(candidate) {
  return {
    candidateCode: stringValue(candidate.candidateCode),
    fullName: stringValue(candidate.fullName),
    candidateTitle: stringValue(candidate.candidateTitle),
    gender: candidate.gender || 'UNKNOWN',
    dateOfBirth: stringValue(candidate.dateOfBirth),
    birthPlace: stringValue(candidate.birthPlace),
    nationality: stringValue(candidate.nationality || 'Việt Nam'),
    citizenId: stringValue(candidate.citizenId),
    citizenIdIssuedDate: stringValue(candidate.citizenIdIssuedDate),
    citizenIdIssuedPlace: stringValue(candidate.citizenIdIssuedPlace),
    permanentAddress: stringValue(candidate.permanentAddress),
    phone: stringValue(candidate.phone),
    email: stringValue(candidate.email),
    departmentId: refId(candidate.department),
    positionId: refId(candidate.position),
    workingConditionId: refId(candidate.workingCondition),
    jobTemplateId: refId(candidate.jobTemplate),
    probationContractType: stringValue(candidate.probationContractType || 'Xác định thời hạn 02 tháng'),
    probationStartDate: stringValue(candidate.probationStartDate),
    probationEndDate: stringValue(candidate.probationEndDate),
    baseSalary: moneyValue(candidate.baseSalary),
    salaryNote: stringValue(candidate.salaryNote),
    jobDescription: stringValue(candidate.jobDescription),
    departmentRuleNote: stringValue(candidate.departmentRuleNote),
    rowVersion: candidate.rowVersion ?? candidate.version,
  };
}

function Field({ label, htmlFor, wide = false, children }) {
  const content = (
    <>
      {htmlFor
        ? <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">{label}</label>
        : <span className="text-sm font-medium text-gray-700">{label}</span>}
      {children}
    </>
  );

  if (htmlFor) {
    return <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>{content}</div>;
  }

  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>{content}</label>
  );
}

function FormSection({ icon: Icon, step, title, description, children }) {
  return (
    <section className="rounded-xl border border-[var(--cfc-border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Mục {step}/3</p>
          <h2 className="mt-0.5 font-semibold text-[var(--cfc-ink)]">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-[var(--cfc-muted)]">{description}</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function HrProbationCandidateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [jobTemplates, setJobTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY_CANDIDATE_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const sortedTemplates = useMemo(
    () => [...jobTemplates].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name), 'vi')),
    [jobTemplates],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrProbationApi.getAllJobTemplates({ sort: 'sortOrder,asc' }, { signal: controller.signal }),
      isEdit ? hrProbationApi.getCandidate(id, { signal: controller.signal }) : Promise.resolve(null),
    ])
      .then(([departments, positions, conditions, templates, candidate]) => {
        if (controller.signal.aborted) return;
        setCatalogs({ departments, positions, conditions });
        setJobTemplates(templates);
        setForm(candidate ? formFromCandidate(candidate) : EMPTY_CANDIDATE_FORM);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'Không thể tải biểu mẫu ứng viên thử việc.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isEdit, reloadKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const applyJobTemplate = (templateId) => {
    const template = jobTemplates.find((item) => item.id === templateId);
    setForm((current) => ({
      ...current,
      jobTemplateId: templateId,
      ...(template ? {
        departmentId: refId(template.department),
        positionId: refId(template.position),
        workingConditionId: refId(template.workingCondition),
        probationContractType: template.probationContractType || current.probationContractType,
        baseSalary: moneyValue(template.baseSalary),
        salaryNote: stringValue(template.salaryNote),
        jobDescription: stringValue(template.jobDescription),
        departmentRuleNote: stringValue(template.departmentRuleNote),
      } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = candidatePayload(form);
      if (isEdit) {
        await hrProbationApi.updateCandidate(id, { rowVersion: form.rowVersion, candidate: payload });
        toast.success('Đã cập nhật ứng viên thử việc');
      } else {
        await hrProbationApi.createCandidate(payload);
        toast.success('Đã thêm ứng viên thử việc');
      }
      navigate(CANDIDATE_LIST_PATH);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu ứng viên thử việc.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPageShell size="readable">
      <SEOHead
        title={`CFC Base | ${isEdit ? 'Chỉnh sửa' : 'Thêm'} ứng viên thử việc`}
        url={`https://cfcbooking.io.vn${isEdit ? `/manager/hr/probation/candidates/${id}/edit` : '/manager/hr/probation/candidates/new'}`}
      />
      <HrPageHeader
        title={isEdit ? 'Chỉnh sửa ứng viên thử việc' : 'Thêm ứng viên thử việc'}
        description="Điền hồ sơ trên một trang riêng; chỉ lưu khi bấm nút lưu ở cuối trang."
        actions={(
          <Button type="button" variant="secondary" onClick={() => navigate(CANDIDATE_LIST_PATH)} disabled={saving}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Quay lại danh sách
          </Button>
        )}
      />

      {loading ? <HrLoading /> : error ? (
        <HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:grid-cols-3">
            <div className="flex items-center gap-3"><UserRound className="h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-xs text-[var(--cfc-muted)]">Họ tên</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--cfc-ink)]">{form.fullName || 'Chưa nhập'}</p></div></div>
            <div className="flex items-center gap-3"><IdCard className="h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-xs text-[var(--cfc-muted)]">Số CCCD</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--cfc-ink)]">{form.citizenId || 'Chưa nhập'}</p></div></div>
            <div className="flex items-center gap-3"><BriefcaseBusiness className="h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-xs text-[var(--cfc-muted)]">Mẫu công việc</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--cfc-ink)]">{sortedTemplates.find((item) => item.id === form.jobTemplateId)?.name || 'Chưa chọn'}</p></div></div>
          </div>

          <FormSection icon={ClipboardCheck} step="1" title="Thông tin ứng viên">
            <Field label="Mã ứng viên"><input maxLength={32} value={form.candidateCode} onChange={(event) => updateForm('candidateCode', event.target.value.toUpperCase())} placeholder="Để trống hệ thống tự tạo" className={INPUT_CLASS} /></Field>
            <Field label="Họ và tên *"><input required maxLength={255} value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Xưng hô"><input maxLength={16} value={form.candidateTitle} onChange={(event) => updateForm('candidateTitle', event.target.value)} placeholder="Ông/Bà" className={INPUT_CLASS} /></Field>
            <Field label="Giới tính"><select value={form.gender} onChange={(event) => updateForm('gender', event.target.value)} className={INPUT_CLASS}><option value="UNKNOWN">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
            <Field label="Ngày sinh"><input type="date" value={form.dateOfBirth} onChange={(event) => updateForm('dateOfBirth', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Quốc tịch"><input maxLength={100} value={form.nationality} onChange={(event) => updateForm('nationality', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Nơi sinh" wide><input maxLength={500} value={form.birthPlace} onChange={(event) => updateForm('birthPlace', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Địa chỉ thường trú" wide><textarea value={form.permanentAddress} onChange={(event) => updateForm('permanentAddress', event.target.value)} className={TEXTAREA_CLASS} /></Field>
            <Field label="Số điện thoại"><input maxLength={32} value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Email"><input type="email" maxLength={320} value={form.email} onChange={(event) => updateForm('email', event.target.value)} className={INPUT_CLASS} /></Field>
          </FormSection>

          <FormSection icon={IdCard} step="2" title="CCCD / định danh" description="Thông tin này được dùng để điền vào hợp đồng thử việc.">
            <Field label="Số CCCD"><input maxLength={32} value={form.citizenId} onChange={(event) => updateForm('citizenId', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Ngày cấp CCCD"><input type="date" value={form.citizenIdIssuedDate} onChange={(event) => updateForm('citizenIdIssuedDate', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Nơi cấp CCCD" htmlFor="probation-issued-place" wide>
              <HrIssuingAuthoritySelect id="probation-issued-place" value={form.citizenIdIssuedPlace} onChange={(value) => updateForm('citizenIdIssuedPlace', value)} />
              <span className="text-xs leading-5 text-[var(--cfc-muted)]">Chọn theo thông tin in trên CCCD để sinh hợp đồng chính xác.</span>
            </Field>
          </FormSection>

          <FormSection icon={BriefcaseBusiness} step="3" title="Công việc thử việc" description="Chọn mẫu công việc để tự điền phòng ban, chức vụ, lương và nội dung công việc.">
            <Field label="Mẫu công việc"><select value={form.jobTemplateId} onChange={(event) => applyJobTemplate(event.target.value)} className={INPUT_CLASS}><option value="">Không dùng mẫu</option>{sortedTemplates.filter((item) => item.status !== 'INACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Loại hợp đồng thử việc"><input maxLength={100} value={form.probationContractType} onChange={(event) => updateForm('probationContractType', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Phòng ban HR" htmlFor="probation-department"><HrSearchableCatalogSelect id="probation-department" value={form.departmentId} onChange={(value) => updateForm('departmentId', value)} items={catalogs.departments} placeholder="Tìm phòng ban theo tên hoặc mã" /></Field>
            <Field label="Chức vụ HR" htmlFor="probation-position"><HrSearchableCatalogSelect id="probation-position" value={form.positionId} onChange={(value) => updateForm('positionId', value)} items={catalogs.positions} placeholder="Tìm chức vụ theo tên hoặc mã" /></Field>
            <Field label="Điều kiện lao động" htmlFor="probation-condition"><HrCatalogSelect id="probation-condition" value={form.workingConditionId} onChange={(value) => updateForm('workingConditionId', value)} items={catalogs.conditions} /></Field>
            <Field label="Lương thử việc"><input type="number" min="0" step="1" value={form.baseSalary} onChange={(event) => updateForm('baseSalary', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Ngày bắt đầu"><input type="date" value={form.probationStartDate} onChange={(event) => updateForm('probationStartDate', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Ngày kết thúc"><input type="date" value={form.probationEndDate} onChange={(event) => updateForm('probationEndDate', event.target.value)} className={INPUT_CLASS} /></Field>
            <Field label="Ghi chú lương" wide><input maxLength={255} value={form.salaryNote} onChange={(event) => updateForm('salaryNote', event.target.value)} placeholder="Ví dụ: /tháng, chưa bao gồm phụ cấp..." className={INPUT_CLASS} /></Field>
            <Field label="Công việc phải làm" wide><textarea value={form.jobDescription} onChange={(event) => updateForm('jobDescription', event.target.value)} className={TEXTAREA_CLASS} /></Field>
            <Field label="Quy định riêng phòng ban" wide><textarea value={form.departmentRuleNote} onChange={(event) => updateForm('departmentRuleNote', event.target.value)} className={TEXTAREA_CLASS} /></Field>
          </FormSection>

          <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(CANDIDATE_LIST_PATH)} disabled={saving}>Hủy</Button>
            <Button type="submit" disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? 'Đang lưu...' : isEdit ? 'Lưu ứng viên' : 'Thêm ứng viên'}</Button>
          </div>
        </form>
      )}
    </HrPageShell>
  );
}

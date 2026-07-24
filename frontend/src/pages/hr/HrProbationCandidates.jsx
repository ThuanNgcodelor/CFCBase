import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Download,
  FileText,
  PencilLine,
  PlayCircle,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { normalizePage } from '../../api/hrApiUtils';
import { hrProbationApi } from '../../api/hrProbationApi';
import { apiErrorMessage, formatHrDate, formatHrDateTime, nonEmpty, statusLabel } from '../../utils/hr';

const INPUT_CLASS = 'h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const TEXTAREA_CLASS = 'min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

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
};

const EMPTY_TEMPLATE_FORM = {
  code: '',
  name: '',
  description: '',
  departmentId: '',
  positionId: '',
  workingConditionId: '',
  probationContractType: 'Xác định thời hạn 02 tháng',
  jobDescription: '',
  baseSalary: '',
  salaryNote: '',
  departmentRuleNote: '',
  sortOrder: 0,
  status: 'ACTIVE',
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
  return normalized ? normalized : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
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

function templatePayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: nullableText(form.description),
    departmentId: form.departmentId || null,
    positionId: form.positionId || null,
    workingConditionId: form.workingConditionId || null,
    probationContractType: nullableText(form.probationContractType),
    jobDescription: nullableText(form.jobDescription),
    baseSalary: nullableNumber(form.baseSalary),
    salaryNote: nullableText(form.salaryNote),
    departmentRuleNote: nullableText(form.departmentRuleNote),
    sortOrder: Number(form.sortOrder) || 0,
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
  };
}

function formFromTemplate(template) {
  return {
    code: stringValue(template.code),
    name: stringValue(template.name),
    description: stringValue(template.description),
    departmentId: refId(template.department),
    positionId: refId(template.position),
    workingConditionId: refId(template.workingCondition),
    probationContractType: stringValue(template.probationContractType || 'Xác định thời hạn 02 tháng'),
    jobDescription: stringValue(template.jobDescription),
    baseSalary: moneyValue(template.baseSalary),
    salaryNote: stringValue(template.salaryNote),
    departmentRuleNote: stringValue(template.departmentRuleNote),
    sortOrder: template.sortOrder ?? 0,
    status: template.status || 'ACTIVE',
    rowVersion: template.rowVersion ?? template.version,
  };
}

function parseFileName(disposition, fallback) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replaceAll('"', ''));
    } catch {
      return utf8Match[1].replaceAll('"', '');
    }
  }
  const normalMatch = disposition.match(/filename="?([^";]+)"?/i);
  return normalMatch?.[1] || fallback;
}

function downloadBlob(response, fallbackFileName) {
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = parseFileName(response.headers?.['content-disposition'], fallbackFileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function Field({ label, wide = false, children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function FormSection({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CatalogSelect({ value, onChange, items, placeholder = 'Chưa chọn' }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS}>
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>{item.name}</option>
      ))}
    </select>
  );
}

export default function HrProbationCandidates() {
  const [activeTab, setActiveTab] = useState('candidates');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
    departmentId: '',
    sort: 'probationEndDate,asc',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [jobTemplates, setJobTemplates] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [candidateEditingId, setCandidateEditingId] = useState(null);
  const [candidateRowVersion, setCandidateRowVersion] = useState(null);
  const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE_FORM);
  const [candidateSaving, setCandidateSaving] = useState(false);

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateEditingId, setTemplateEditingId] = useState(null);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [templateSaving, setTemplateSaving] = useState(false);

  const [busyAction, setBusyAction] = useState('');

  const sortedTemplates = useMemo(
    () => [...jobTemplates].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name), 'vi')),
    [jobTemplates],
  );

  const loadOptions = useCallback((signal) => {
    setOptionsError('');
    return Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal }),
      hrProbationApi.getAllJobTemplates({ sort: 'sortOrder,asc' }, { signal }),
    ])
      .then(([departments, positions, conditions, templates]) => {
        setCatalogs({ departments, positions, conditions });
        setJobTemplates(templates);
      })
      .catch((requestError) => {
        if (!signal?.aborted) {
          setOptionsError(apiErrorMessage(requestError, 'Không thể tải danh mục HR hoặc mẫu công việc thử việc.'));
        }
      });
  }, []);

  const loadCandidates = useCallback((signal) => {
    setLoading(true);
    setError('');
    const params = {
      page,
      size: 20,
      sort: appliedFilters.sort,
    };
    if (appliedFilters.keyword.trim()) params.keyword = appliedFilters.keyword.trim();
    if (appliedFilters.status) params.status = appliedFilters.status;
    if (appliedFilters.departmentId) params.departmentId = appliedFilters.departmentId;
    return hrProbationApi.getCandidates(params, { signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => {
        if (!signal?.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh sách ứng viên thử việc.'));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [appliedFilters, page]);

  useEffect(() => {
    const controller = new AbortController();
    loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions, optionsReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    loadCandidates(controller.signal);
    return () => controller.abort();
  }, [loadCandidates, reloadKey]);

  const updateCandidateForm = (field, value) => {
    setCandidateForm((current) => ({ ...current, [field]: value }));
  };

  const updateTemplateForm = (field, value) => {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateCandidate = () => {
    setCandidateEditingId(null);
    setCandidateRowVersion(null);
    setCandidateForm(EMPTY_CANDIDATE_FORM);
    setShowCandidateForm(true);
    setActiveTab('candidates');
  };

  const openEditCandidate = async (candidate) => {
    setBusyAction(`edit-${candidate.id}`);
    try {
      const detail = await hrProbationApi.getCandidate(candidate.id);
      setCandidateEditingId(detail.id);
      setCandidateRowVersion(detail.rowVersion ?? detail.version);
      setCandidateForm(formFromCandidate(detail));
      setShowCandidateForm(true);
      setActiveTab('candidates');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải chi tiết ứng viên.'));
    } finally {
      setBusyAction('');
    }
  };

  const closeCandidateForm = () => {
    if (candidateSaving) return;
    setShowCandidateForm(false);
    setCandidateEditingId(null);
    setCandidateRowVersion(null);
    setCandidateForm(EMPTY_CANDIDATE_FORM);
  };

  const applyJobTemplate = (templateId) => {
    const template = jobTemplates.find((item) => item.id === templateId);
    setCandidateForm((current) => ({
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

  const saveCandidate = async (event) => {
    event.preventDefault();
    setCandidateSaving(true);
    try {
      if (candidateEditingId) {
        await hrProbationApi.updateCandidate(candidateEditingId, {
          rowVersion: candidateRowVersion,
          candidate: candidatePayload(candidateForm),
        });
        toast.success('Đã cập nhật ứng viên thử việc');
      } else {
        await hrProbationApi.createCandidate(candidatePayload(candidateForm));
        toast.success('Đã thêm ứng viên thử việc');
      }
      setShowCandidateForm(false);
      setCandidateEditingId(null);
      setCandidateRowVersion(null);
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setPage(0);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu ứng viên thử việc.'));
    } finally {
      setCandidateSaving(false);
    }
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setTemplateSaving(true);
    try {
      const payload = templatePayload(templateForm);
      if (templateEditingId) {
        await hrProbationApi.updateJobTemplate(templateEditingId, {
          rowVersion: templateForm.rowVersion,
          template: payload,
          status: templateForm.status,
        });
        toast.success('Đã cập nhật mẫu công việc thử việc');
      } else {
        await hrProbationApi.createJobTemplate(payload);
        toast.success('Đã thêm mẫu công việc thử việc');
      }
      setShowTemplateForm(false);
      setTemplateEditingId(null);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      setOptionsReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu mẫu công việc.'));
    } finally {
      setTemplateSaving(false);
    }
  };

  const openCreateTemplate = () => {
    setTemplateEditingId(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setShowTemplateForm(true);
    setActiveTab('templates');
  };

  const openEditTemplate = (template) => {
    setTemplateEditingId(template.id);
    setTemplateForm(formFromTemplate(template));
    setShowTemplateForm(true);
    setActiveTab('templates');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    const next = { keyword: '', status: '', departmentId: '', sort: 'probationEndDate,asc' };
    setFilters(next);
    setAppliedFilters(next);
    setPage(0);
  };

  const runCandidateAction = async (candidate, action) => {
    if (action === 'generate' && !window.confirm(`Tạo hợp đồng thử việc cho ${candidate.fullName}?`)) return;
    if (action === 'start' && !window.confirm(`Chuyển ${candidate.fullName} sang trạng thái đang thử việc?`)) return;
    if (action === 'pass' && !window.confirm(`Đánh dấu ${candidate.fullName} đạt thử việc?`)) return;
    if (action === 'convert' && !window.confirm(`Chuyển ${candidate.fullName} thành hồ sơ nhân sự nháp?`)) return;
    let reason = null;
    if (action === 'fail') {
      reason = window.prompt(`Nhập lý do ${candidate.fullName} không đạt thử việc`);
      if (!reason?.trim()) return;
    }

    setBusyAction(`${action}-${candidate.id}`);
    try {
      if (action === 'generate') {
        await hrProbationApi.generateContract(candidate.id, { signDate: todayInput() });
        toast.success('Đã tạo hợp đồng thử việc');
      }
      if (action === 'start') {
        await hrProbationApi.startProbation(candidate.id, { rowVersion: candidate.rowVersion, reason: null });
        toast.success('Đã bắt đầu thử việc');
      }
      if (action === 'pass') {
        await hrProbationApi.markPassed(candidate.id, { rowVersion: candidate.rowVersion, reason: null });
        toast.success('Đã đánh dấu đạt thử việc');
      }
      if (action === 'fail') {
        await hrProbationApi.markFailed(candidate.id, { rowVersion: candidate.rowVersion, reason: reason.trim() });
        toast.success('Đã đánh dấu không đạt thử việc');
      }
      if (action === 'convert') {
        await hrProbationApi.convertToEmployeeDraft(candidate.id, {
          rowVersion: candidate.rowVersion,
          employeeCode: candidate.candidateCode,
          hireDate: null,
        });
        toast.success('Đã chuyển thành hồ sơ nhân sự nháp');
      }
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xử lý ứng viên thử việc.'));
    } finally {
      setBusyAction('');
    }
  };

  const downloadContract = async (contract) => {
    if (!contract?.id) return;
    setBusyAction(`download-${contract.id}`);
    try {
      const response = await hrProbationApi.downloadContract(contract.id);
      downloadBlob(response, contract.generatedFileName || `hop-dong-thu-viec-${contract.contractNo}.docx`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải hợp đồng thử việc.'));
    } finally {
      setBusyAction('');
    }
  };

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Ứng viên thử việc" url="https://cfcbooking.io.vn/manager/hr/probation" />
      <HrPageHeader
        title="Ứng viên thử việc"
        description="Tạo hồ sơ ứng viên, sinh hợp đồng thử việc từ file Word mẫu, theo dõi kết quả thử việc rồi chuyển thành hồ sơ nhân sự nháp khi đạt."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={openCreateTemplate}>
              <FileText className="mr-1.5 h-4 w-4" />Mẫu công việc
            </Button>
            <Button type="button" onClick={openCreateCandidate}>
              <UserPlus className="mr-1.5 h-4 w-4" />Thêm ứng viên
            </Button>
          </>
        )}
      />

      <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button type="button" onClick={() => setActiveTab('candidates')} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'candidates' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          Ứng viên
        </button>
        <button type="button" onClick={() => setActiveTab('templates')} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'templates' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          Mẫu công việc thử việc
        </button>
      </div>

      {optionsError && (
        <div className="mb-4">
          <HrError message={optionsError} onRetry={() => setOptionsReloadKey((value) => value + 1)} />
        </div>
      )}

      {activeTab === 'candidates' && (
        <>
          {showCandidateForm && (
            <form onSubmit={saveCandidate} className="mb-5 space-y-5 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{candidateEditingId ? 'Chỉnh sửa ứng viên thử việc' : 'Thêm ứng viên thử việc'}</h2>
                  <p className="mt-1 text-sm text-gray-500">Điền đủ thông tin CCCD, địa chỉ, ngày thử việc và công việc để có thể sinh hợp đồng Word.</p>
                </div>
                <button type="button" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" onClick={closeCandidateForm}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <FormSection title="Thông tin ứng viên">
                <Field label="Mã ứng viên"><input maxLength={32} value={candidateForm.candidateCode} onChange={(event) => updateCandidateForm('candidateCode', event.target.value.toUpperCase())} placeholder="Để trống hệ thống tự tạo" className={INPUT_CLASS} /></Field>
                <Field label="Họ và tên *"><input required maxLength={255} value={candidateForm.fullName} onChange={(event) => updateCandidateForm('fullName', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Xưng hô"><input maxLength={16} value={candidateForm.candidateTitle} onChange={(event) => updateCandidateForm('candidateTitle', event.target.value)} placeholder="Ông/Bà" className={INPUT_CLASS} /></Field>
                <Field label="Giới tính"><select value={candidateForm.gender} onChange={(event) => updateCandidateForm('gender', event.target.value)} className={INPUT_CLASS}><option value="UNKNOWN">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
                <Field label="Ngày sinh"><input type="date" value={candidateForm.dateOfBirth} onChange={(event) => updateCandidateForm('dateOfBirth', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Quốc tịch"><input maxLength={100} value={candidateForm.nationality} onChange={(event) => updateCandidateForm('nationality', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Nơi sinh" wide><input maxLength={500} value={candidateForm.birthPlace} onChange={(event) => updateCandidateForm('birthPlace', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Địa chỉ thường trú" wide><textarea value={candidateForm.permanentAddress} onChange={(event) => updateCandidateForm('permanentAddress', event.target.value)} className={TEXTAREA_CLASS} /></Field>
                <Field label="Số điện thoại"><input maxLength={32} value={candidateForm.phone} onChange={(event) => updateCandidateForm('phone', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Email"><input type="email" maxLength={320} value={candidateForm.email} onChange={(event) => updateCandidateForm('email', event.target.value)} className={INPUT_CLASS} /></Field>
              </FormSection>

              <FormSection title="CCCD / định danh">
                <Field label="Số CCCD"><input maxLength={32} value={candidateForm.citizenId} onChange={(event) => updateCandidateForm('citizenId', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Ngày cấp CCCD"><input type="date" value={candidateForm.citizenIdIssuedDate} onChange={(event) => updateCandidateForm('citizenIdIssuedDate', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Nơi cấp CCCD" wide><input maxLength={255} value={candidateForm.citizenIdIssuedPlace} onChange={(event) => updateCandidateForm('citizenIdIssuedPlace', event.target.value)} className={INPUT_CLASS} /></Field>
              </FormSection>

              <FormSection title="Công việc thử việc" description="Có thể chọn mẫu công việc để tự điền phòng ban, chức vụ, lương và nội dung công việc.">
                <Field label="Mẫu công việc"><select value={candidateForm.jobTemplateId} onChange={(event) => applyJobTemplate(event.target.value)} className={INPUT_CLASS}><option value="">Không dùng mẫu</option>{sortedTemplates.filter((item) => item.status !== 'INACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <Field label="Loại hợp đồng thử việc"><input maxLength={100} value={candidateForm.probationContractType} onChange={(event) => updateCandidateForm('probationContractType', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Phòng ban HR"><CatalogSelect value={candidateForm.departmentId} onChange={(value) => updateCandidateForm('departmentId', value)} items={catalogs.departments} /></Field>
                <Field label="Chức vụ HR"><CatalogSelect value={candidateForm.positionId} onChange={(value) => updateCandidateForm('positionId', value)} items={catalogs.positions} /></Field>
                <Field label="Điều kiện lao động"><CatalogSelect value={candidateForm.workingConditionId} onChange={(value) => updateCandidateForm('workingConditionId', value)} items={catalogs.conditions} /></Field>
                <Field label="Lương thử việc"><input type="number" min="0" step="1" value={candidateForm.baseSalary} onChange={(event) => updateCandidateForm('baseSalary', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Ngày bắt đầu"><input type="date" value={candidateForm.probationStartDate} onChange={(event) => updateCandidateForm('probationStartDate', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Ngày kết thúc"><input type="date" value={candidateForm.probationEndDate} onChange={(event) => updateCandidateForm('probationEndDate', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Ghi chú lương" wide><input maxLength={255} value={candidateForm.salaryNote} onChange={(event) => updateCandidateForm('salaryNote', event.target.value)} placeholder="Ví dụ: /tháng, chưa bao gồm phụ cấp..." className={INPUT_CLASS} /></Field>
                <Field label="Công việc phải làm" wide><textarea value={candidateForm.jobDescription} onChange={(event) => updateCandidateForm('jobDescription', event.target.value)} className={TEXTAREA_CLASS} /></Field>
                <Field label="Quy định riêng phòng ban" wide><textarea value={candidateForm.departmentRuleNote} onChange={(event) => updateCandidateForm('departmentRuleNote', event.target.value)} className={TEXTAREA_CLASS} /></Field>
              </FormSection>

              <div className="sticky bottom-3 z-10 flex flex-col justify-end gap-2 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row">
                <Button type="button" variant="secondary" onClick={closeCandidateForm} disabled={candidateSaving}>Đóng</Button>
                <Button type="submit" disabled={candidateSaving}><UserCheck className="mr-1.5 h-4 w-4" />{candidateSaving ? 'Đang lưu...' : candidateEditingId ? 'Lưu ứng viên' : 'Thêm ứng viên'}</Button>
              </div>
            </form>
          )}

          <form onSubmit={applyFilters} className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_180px_220px_180px_auto_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tìm mã hoặc tên ứng viên" className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
            </label>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS}>
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="CONTRACT_CREATED">Đã tạo HĐ</option>
              <option value="IN_PROBATION">Đang thử việc</option>
              <option value="PASSED">Đạt thử việc</option>
              <option value="FAILED">Không đạt</option>
              <option value="CONVERTED">Đã chuyển hồ sơ</option>
            </select>
            <CatalogSelect value={filters.departmentId} onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))} items={catalogs.departments} placeholder="Tất cả phòng ban" />
            <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className={INPUT_CLASS}>
              <option value="probationEndDate,asc">Sắp hết thử việc</option>
              <option value="updatedAt,desc">Mới cập nhật</option>
              <option value="fullName,asc">Tên A-Z</option>
              <option value="candidateCode,asc">Mã tăng dần</option>
            </select>
            <Button type="button" variant="secondary" onClick={resetFilters}>Xóa lọc</Button>
            <Button type="submit"><Search className="mr-1 h-4 w-4" />Áp dụng</Button>
          </form>

          {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1180px] divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-4">Ứng viên</th>
                  <th className="px-5 py-4">Phòng ban / chức vụ</th>
                  <th className="px-5 py-4">Thử việc</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Hợp đồng</th>
                  <th className="px-5 py-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải ứng viên thử việc...</td></tr>
                ) : result.content.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    busyAction={busyAction}
                    onEdit={openEditCandidate}
                    onAction={runCandidateAction}
                    onDownload={downloadContract}
                  />
                ))}
                {!loading && result.content.length === 0 && <tr><td colSpan="6" className="p-5"><HrEmpty title="Chưa có ứng viên thử việc" description="Bấm “Thêm ứng viên” để bắt đầu nhập hồ sơ và sinh hợp đồng thử việc." /></td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-5">
          {showTemplateForm && (
            <form onSubmit={saveTemplate} className="space-y-5 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{templateEditingId ? 'Chỉnh sửa mẫu công việc' : 'Thêm mẫu công việc'}</h2>
                  <p className="mt-1 text-sm text-gray-500">Mẫu này dùng để tự điền nhanh thông tin khi thêm ứng viên thử việc.</p>
                </div>
                <button type="button" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" onClick={() => setShowTemplateForm(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FormSection title="Thông tin mẫu">
                <Field label="Mã mẫu *"><input required maxLength={32} value={templateForm.code} onChange={(event) => updateTemplateForm('code', event.target.value.toUpperCase())} className={INPUT_CLASS} /></Field>
                <Field label="Tên mẫu *"><input required maxLength={255} value={templateForm.name} onChange={(event) => updateTemplateForm('name', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Phòng ban HR"><CatalogSelect value={templateForm.departmentId} onChange={(value) => updateTemplateForm('departmentId', value)} items={catalogs.departments} /></Field>
                <Field label="Chức vụ HR"><CatalogSelect value={templateForm.positionId} onChange={(value) => updateTemplateForm('positionId', value)} items={catalogs.positions} /></Field>
                <Field label="Điều kiện lao động"><CatalogSelect value={templateForm.workingConditionId} onChange={(value) => updateTemplateForm('workingConditionId', value)} items={catalogs.conditions} /></Field>
                <Field label="Loại hợp đồng"><input maxLength={100} value={templateForm.probationContractType} onChange={(event) => updateTemplateForm('probationContractType', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Lương thử việc"><input type="number" min="0" step="1" value={templateForm.baseSalary} onChange={(event) => updateTemplateForm('baseSalary', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Thứ tự"><input type="number" min="0" value={templateForm.sortOrder} onChange={(event) => updateTemplateForm('sortOrder', event.target.value)} className={INPUT_CLASS} /></Field>
                {templateEditingId && (
                  <Field label="Trạng thái"><select value={templateForm.status} onChange={(event) => updateTemplateForm('status', event.target.value)} className={INPUT_CLASS}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></Field>
                )}
                <Field label="Mô tả" wide><textarea value={templateForm.description} onChange={(event) => updateTemplateForm('description', event.target.value)} className={TEXTAREA_CLASS} /></Field>
                <Field label="Ghi chú lương" wide><input maxLength={255} value={templateForm.salaryNote} onChange={(event) => updateTemplateForm('salaryNote', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Công việc phải làm" wide><textarea value={templateForm.jobDescription} onChange={(event) => updateTemplateForm('jobDescription', event.target.value)} className={TEXTAREA_CLASS} /></Field>
                <Field label="Quy định riêng phòng ban" wide><textarea value={templateForm.departmentRuleNote} onChange={(event) => updateTemplateForm('departmentRuleNote', event.target.value)} className={TEXTAREA_CLASS} /></Field>
              </FormSection>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowTemplateForm(false)} disabled={templateSaving}>Đóng</Button>
                <Button type="submit" disabled={templateSaving}>{templateSaving ? 'Đang lưu...' : 'Lưu mẫu công việc'}</Button>
              </div>
            </form>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={openCreateTemplate}><Plus className="mr-1.5 h-4 w-4" />Thêm mẫu công việc</Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-4">Mẫu công việc</th>
                  <th className="px-5 py-4">Phòng ban / chức vụ</th>
                  <th className="px-5 py-4">Lương</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                      <p className="mt-1 text-xs text-emerald-700">{template.code}</p>
                      {template.jobDescription && <p className="mt-1 line-clamp-2 max-w-md text-xs text-gray-500">{template.jobDescription}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      <p>{nonEmpty(template.department?.name)}</p>
                      <p className="mt-1 text-xs text-gray-400">{nonEmpty(template.position?.name)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      <p>{template.baseSalary ? Number(template.baseSalary).toLocaleString('vi-VN') : '—'}</p>
                      <p className="mt-1 text-xs text-gray-400">{nonEmpty(template.salaryNote)}</p>
                    </td>
                    <td className="px-5 py-4"><HrStatusBadge status={template.status} /></td>
                    <td className="px-5 py-4 text-right">
                      <Button type="button" size="sm" variant="secondary" onClick={() => openEditTemplate(template)}><PencilLine className="mr-1 h-4 w-4" />Sửa</Button>
                    </td>
                  </tr>
                ))}
                {sortedTemplates.length === 0 && <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có mẫu công việc" description="Có thể nhập ứng viên thủ công, nhưng tạo mẫu sẽ nhanh hơn khi nhiều vị trí có lương/công việc giống nhau." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </HrPageShell>
  );
}

function CandidateRow({ candidate, busyAction, onEdit, onAction, onDownload }) {
  const latestContract = candidate.latestContract;
  const canGenerate = !['FAILED', 'CONVERTED', 'CANCELLED'].includes(candidate.status);
  const canStart = ['DRAFT', 'CONTRACT_CREATED'].includes(candidate.status);
  const canPass = candidate.status === 'IN_PROBATION';
  const canFail = !['FAILED', 'CONVERTED', 'CANCELLED'].includes(candidate.status);
  const canConvert = candidate.status === 'PASSED';
  const disabled = Boolean(busyAction);

  return (
    <tr className="hover:bg-gray-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
            {candidate.fullName?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{candidate.fullName}</p>
            <p className="mt-1 text-xs text-gray-500">Mã: {candidate.candidateCode}</p>
            {candidate.phone && <p className="mt-0.5 text-xs text-gray-400">{candidate.phone}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-gray-600">
        <p>{nonEmpty(candidate.department?.name)}</p>
        <p className="mt-1 text-xs text-gray-400">{nonEmpty(candidate.position?.name)}</p>
      </td>
      <td className="px-5 py-4 text-sm text-gray-600">
        <p>{formatHrDate(candidate.probationStartDate)} → {formatHrDate(candidate.probationEndDate)}</p>
        <p className="mt-1 text-xs text-gray-400">Cập nhật: {formatHrDateTime(candidate.updatedAt)}</p>
      </td>
      <td className="px-5 py-4"><HrStatusBadge status={candidate.status} label={candidate.status === 'FAILED' ? 'Không đạt' : undefined} /></td>
      <td className="px-5 py-4 text-sm text-gray-600">
        {latestContract ? (
          <button type="button" disabled={disabled} onClick={() => onDownload(latestContract)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            {latestContract.contractNo}/{latestContract.contractYear}
          </button>
        ) : (
          <span className="text-xs text-gray-400">Chưa tạo</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onEdit(candidate)}><PencilLine className="mr-1 h-3.5 w-3.5" />Sửa</Button>
          {canGenerate && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'generate')}><FileText className="mr-1 h-3.5 w-3.5" />Tạo HĐ</Button>}
          {canStart && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'start')}><PlayCircle className="mr-1 h-3.5 w-3.5" />Bắt đầu</Button>}
          {canPass && <Button type="button" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'pass')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Đạt</Button>}
          {canFail && <Button type="button" size="sm" variant="danger" disabled={disabled} onClick={() => onAction(candidate, 'fail')}><XCircle className="mr-1 h-3.5 w-3.5" />Không đạt</Button>}
          {canConvert && <Button type="button" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'convert')}><UserCheck className="mr-1 h-3.5 w-3.5" />Chuyển hồ sơ</Button>}
          {candidate.convertedEmployeeId && <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">{statusLabel('CONVERTED')}</span>}
        </div>
      </td>
    </tr>
  );
}

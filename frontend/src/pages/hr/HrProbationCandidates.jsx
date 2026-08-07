import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  XCircle,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrDrawer, HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import HrEmploymentContractFields, { ContractExportButton } from '../../components/hr/HrEmploymentContractFields';
import { HR_INPUT_CLASS, HrField } from '../../components/hr/HrFormControls';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { hrEmploymentContractApi } from '../../api/hrEmploymentContractApi';
import { normalizePage } from '../../api/hrApiUtils';
import { hrOnboardingApi } from '../../api/hrOnboardingApi';
import { hrProbationApi } from '../../api/hrProbationApi';
import { apiErrorMessage, formatHrDate, formatHrDateTime, nonEmpty, statusLabel } from '../../utils/hr';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';
import {
  addDaysIso,
  contractPayload,
  createContractForm,
  newIdempotencyKey,
  validateContractForm,
} from '../../utils/hrOnboarding';

const INPUT_CLASS = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:h-10 sm:text-sm';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'templates' ? 'templates' : 'candidates';
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

  const [catalogs, setCatalogs] = useState({ departments: [] });
  const [jobTemplates, setJobTemplates] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);

  const [busyAction, setBusyAction] = useState('');
  const [onboardingCandidate, setOnboardingCandidate] = useState(null);
  const [onboardingForm, setOnboardingForm] = useState(null);
  const [onboardingIdempotencyKey, setOnboardingIdempotencyKey] = useState('');

  const sortedTemplates = useMemo(
    () => [...jobTemplates].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name), 'vi')),
    [jobTemplates],
  );

  const loadOptions = useCallback((signal) => {
    setOptionsError('');
    return Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal }),
      hrProbationApi.getAllJobTemplates({ sort: 'sortOrder,asc' }, { signal }),
    ])
      .then(([departments, templates]) => {
        setCatalogs({ departments });
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

  const selectTab = useCallback((tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'templates') {
      next.set('tab', 'templates');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openCreateCandidate = () => {
    navigate('/manager/hr/probation/candidates/new');
  };

  const openEditCandidate = (candidate) => {
    navigate(`/manager/hr/probation/candidates/${candidate.id}/edit`);
  };

  const openCreateTemplate = () => {
    navigate('/manager/hr/probation/templates/new');
  };

  const openEditTemplate = (template) => {
    navigate(`/manager/hr/probation/templates/${template.id}/edit`);
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

  const openOnboarding = (candidate) => {
    const effectiveFrom = addDaysIso(candidate.probationEndDate) || todayInput();
    setOnboardingCandidate(candidate);
    setOnboardingForm({
      employeeCode: candidate.candidateCode || '',
      contract: createContractForm(effectiveFrom),
    });
    setOnboardingIdempotencyKey(newIdempotencyKey('office-onboarding'));
  };

  const closeOnboarding = () => {
    if (busyAction === 'onboarding') return;
    setOnboardingCandidate(null);
    setOnboardingForm(null);
    setOnboardingIdempotencyKey('');
  };

  const completeOnboarding = async (event) => {
    event.preventDefault();
    const exportRequested = event.nativeEvent.submitter?.value === 'export';
    if (!onboardingCandidate || !onboardingForm) return;
    const contractError = validateContractForm(onboardingForm.contract);
    if (contractError) {
      toast.error(contractError);
      return;
    }

    setBusyAction('onboarding');
    try {
      const response = await hrOnboardingApi.completeProbationOnboarding(onboardingCandidate.id, {
        rowVersion: onboardingCandidate.rowVersion,
        idempotencyKey: onboardingIdempotencyKey,
        employeeCode: onboardingForm.employeeCode.trim() || onboardingCandidate.candidateCode,
        hireDate: onboardingForm.contract.effectiveFrom,
        contract: contractPayload(onboardingForm.contract),
      });
      toast.success('Đã lập hợp đồng chính thức và tạo hồ sơ nhân sự nháp. Tiếp theo: tạo Tăng nhân sự.');
      if (exportRequested) {
        try {
          const document = await hrEmploymentContractApi.generateDocument(response?.contract?.id);
          const file = await hrEmploymentContractApi.downloadDocument(document.id);
          downloadResponseBlob(file, document.generatedFileName || `hop-dong-lao-dong-${onboardingForm.employeeCode || 'van-phong'}.docx`);
          toast.success('Đã tải hợp đồng lao động khối văn phòng.');
        } catch (exportError) {
          toast.error(apiErrorMessage(exportError, 'Hồ sơ đã được lưu nhưng chưa thể xuất file hợp đồng. Bạn có thể xuất lại tại chi tiết nhân sự.'));
        }
      }
      const params = new URLSearchParams({
        create: 'increase',
        employeeId: response?.employee?.id || '',
        effectiveDate: onboardingForm.contract.effectiveFrom,
      });
      setOnboardingCandidate(null);
      setOnboardingForm(null);
      navigate(`/manager/hr/movements?${params.toString()}`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể hoàn tất hồ sơ sau thử việc.'));
    } finally {
      setBusyAction('');
    }
  };

  const runCandidateAction = async (candidate, action) => {
    if (action === 'onboarding') {
      openOnboarding(candidate);
      return;
    }
    if (action === 'generate' && !window.confirm(`Tạo hợp đồng thử việc cho ${candidate.fullName}?`)) return;
    if (action === 'start' && !window.confirm(`Chuyển ${candidate.fullName} sang trạng thái đang thử việc?`)) return;
    if (action === 'pass' && !window.confirm(`Đánh dấu ${candidate.fullName} đạt thử việc?`)) return;
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
        description="Luồng văn phòng: tạo hợp đồng thử việc, bắt đầu thử việc, đánh giá đạt, chọn hợp đồng chính thức rồi chuyển thành hồ sơ nhân sự nháp chờ Tăng."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => selectTab('templates')}>
              <FileText className="mr-1.5 h-4 w-4" />Mẫu công việc
            </Button>
            <Button type="button" onClick={openCreateCandidate}>
              <UserPlus className="mr-1.5 h-4 w-4" />Thêm ứng viên
            </Button>
          </>
        )}
      />

      <HrDrawer
        isOpen={Boolean(onboardingCandidate && onboardingForm)}
        onClose={closeOnboarding}
        title="Lập hợp đồng lao động chính thức"
        description={onboardingCandidate ? `${onboardingCandidate.fullName} đã đạt thử việc. Chọn hợp đồng 1 năm hoặc không xác định thời hạn trước khi tạo hồ sơ nhân sự nháp.` : ''}
        size="wide"
      >
        {onboardingCandidate && onboardingForm && (
          <form onSubmit={completeOnboarding} className="flex min-h-full flex-col">
            <div className="flex-1 space-y-6 px-5 py-6 sm:px-7">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                Ngày vào làm của hồ sơ nhân sự và ngày hiệu lực hợp đồng được đồng bộ. Sau khi lưu, hồ sơ vẫn ở trạng thái nháp cho đến khi nghiệp vụ Tăng được xác nhận.
              </div>
              <HrField label="Mã nhân sự *" htmlFor="office-employee-code">
                <input
                  id="office-employee-code"
                  required
                  maxLength={32}
                  disabled={busyAction === 'onboarding'}
                  value={onboardingForm.employeeCode}
                  onChange={(event) => setOnboardingForm((current) => ({ ...current, employeeCode: event.target.value.toUpperCase() }))}
                  className={HR_INPUT_CLASS}
                />
              </HrField>
              <HrEmploymentContractFields
                compact
                disabled={busyAction === 'onboarding'}
                value={onboardingForm.contract}
                onChange={(contract) => setOnboardingForm((current) => ({ ...current, contract }))}
              />
            </div>
            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-200 bg-white/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end sm:px-7">
              <ContractExportButton
                type="submit"
                name="submitIntent"
                value="export"
                disabled={busyAction === 'onboarding'}
                loading={busyAction === 'onboarding'}
                className="sm:mr-auto"
              >
                {busyAction === 'onboarding' ? 'Đang lưu và xuất...' : 'Lưu và xuất hợp đồng'}
              </ContractExportButton>
              <Button type="button" variant="secondary" disabled={busyAction === 'onboarding'} onClick={closeOnboarding}>Hủy</Button>
              <Button type="submit" disabled={busyAction === 'onboarding'}>
                <UserCheck className="mr-1.5 h-4 w-4" />{busyAction === 'onboarding' ? 'Đang lưu...' : 'Lưu và tạo hồ sơ nháp'}
              </Button>
            </div>
          </form>
        )}
      </HrDrawer>

      <nav className="mb-5 flex max-w-full gap-6 overflow-x-auto border-b border-[var(--cfc-border)]" aria-label="Khu vực thử việc">
        <button type="button" onClick={() => selectTab('candidates')} className={`relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition ${activeTab === 'candidates' ? 'text-emerald-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-emerald-600' : 'text-[var(--cfc-muted)] hover:text-[var(--cfc-ink)]'}`}>
          Ứng viên <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{result.totalElements}</span>
        </button>
        <button type="button" onClick={() => selectTab('templates')} className={`relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition ${activeTab === 'templates' ? 'text-emerald-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-emerald-600' : 'text-[var(--cfc-muted)] hover:text-[var(--cfc-ink)]'}`}>
          Mẫu công việc <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{sortedTemplates.length}</span>
        </button>
      </nav>

      {optionsError && (
        <div className="mb-4">
          <HrError message={optionsError} onRetry={() => setOptionsReloadKey((value) => value + 1)} />
        </div>
      )}

      {activeTab === 'candidates' && (
        <>
          <form onSubmit={applyFilters} className="hr-filter-grid hr-filter-grid--probation mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tìm mã hoặc tên ứng viên" className="h-11 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-base outline-none focus:border-emerald-500 sm:h-10 sm:text-sm" />
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

          <div className="hr-responsive-table hr-responsive-table--extra-wide cfc-scrollbar overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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

          <div className="hr-responsive-cards hr-responsive-cards--extra-wide space-y-3">
            {loading ? (
              <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">Đang tải ứng viên thử việc...</div>
            ) : result.content.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                busyAction={busyAction}
                onEdit={openEditCandidate}
                onAction={runCandidateAction}
                onDownload={downloadContract}
              />
            ))}
            {!loading && result.content.length === 0 && <HrEmpty title="Chưa có ứng viên thử việc" description="Bấm “Thêm ứng viên” để bắt đầu nhập hồ sơ và sinh hợp đồng thử việc." />}
          </div>

          <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreateTemplate}><Plus className="mr-1.5 h-4 w-4" />Thêm mẫu công việc</Button>
          </div>

          <div className="hr-responsive-table hr-responsive-table--compact cfc-scrollbar overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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

          <div className="hr-responsive-cards hr-responsive-cards--compact space-y-3">
            {sortedTemplates.map((template) => (
              <div key={template.id} className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                    <p className="mt-0.5 text-xs text-emerald-700">{template.code}</p>
                  </div>
                  <HrStatusBadge status={template.status} />
                </div>
                {template.jobDescription && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{template.jobDescription}</p>}
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
                  <div><span className="text-gray-400">Phòng ban</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(template.department?.name)}</p></div>
                  <div><span className="text-gray-400">Chức vụ</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(template.position?.name)}</p></div>
                  <div className="col-span-2"><span className="text-gray-400">Lương</span><p className="mt-1 font-medium text-gray-700">{template.baseSalary ? Number(template.baseSalary).toLocaleString('vi-VN') : '—'} {template.salaryNote ? `(${template.salaryNote})` : ''}</p></div>
                </div>
                <div className="mt-3">
                  <Button type="button" className="w-full" size="sm" variant="secondary" onClick={() => openEditTemplate(template)}><PencilLine className="mr-1 h-3.5 w-3.5" />Sửa</Button>
                </div>
              </div>
            ))}
            {sortedTemplates.length === 0 && <HrEmpty title="Chưa có mẫu công việc" description="Có thể nhập ứng viên thủ công, nhưng tạo mẫu sẽ nhanh hơn khi nhiều vị trí có lương/công việc giống nhau." />}
          </div>
        </div>
      )}
    </HrPageShell>
  );
}

function CandidateRow({ candidate, busyAction, onEdit, onAction, onDownload }) {
  const latestContract = candidate.latestContract;
  const canGenerate = ['DRAFT', 'CONTRACT_CREATED'].includes(candidate.status);
  const canStart = candidate.status === 'CONTRACT_CREATED';
  const canPass = candidate.status === 'IN_PROBATION';
  const canFail = candidate.status === 'IN_PROBATION';
  const canOnboard = candidate.status === 'PASSED';
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
          {canGenerate && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'generate')}><FileText className="mr-1 h-3.5 w-3.5" />HĐ thử việc</Button>}
          {canStart && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'start')}><PlayCircle className="mr-1 h-3.5 w-3.5" />Bắt đầu</Button>}
          {canPass && <Button type="button" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'pass')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Đạt</Button>}
          {canFail && <Button type="button" size="sm" variant="danger" disabled={disabled} onClick={() => onAction(candidate, 'fail')}><XCircle className="mr-1 h-3.5 w-3.5" />Không đạt</Button>}
          {canOnboard && <Button type="button" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'onboarding')}><UserCheck className="mr-1 h-3.5 w-3.5" />Lập HĐ chính thức</Button>}
          {candidate.convertedEmployeeId && <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">{statusLabel('CONVERTED')}</span>}
        </div>
      </td>
    </tr>
  );
}

function CandidateCard({ candidate, busyAction, onEdit, onAction, onDownload }) {
  const latestContract = candidate.latestContract;
  const canGenerate = ['DRAFT', 'CONTRACT_CREATED'].includes(candidate.status);
  const canStart = candidate.status === 'CONTRACT_CREATED';
  const canPass = candidate.status === 'IN_PROBATION';
  const canFail = candidate.status === 'IN_PROBATION';
  const canOnboard = candidate.status === 'PASSED';
  const disabled = Boolean(busyAction);

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
            {candidate.fullName?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{candidate.fullName}</p>
            <p className="mt-0.5 text-xs text-gray-500">{candidate.candidateCode}</p>
          </div>
        </div>
        <HrStatusBadge status={candidate.status} label={candidate.status === 'FAILED' ? 'Không đạt' : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
        <div><span className="text-gray-400">Phòng ban</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(candidate.department?.name)}</p></div>
        <div><span className="text-gray-400">Chức vụ</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(candidate.position?.name)}</p></div>
        <div><span className="text-gray-400">Thử việc</span><p className="mt-1 font-medium text-gray-700">{formatHrDate(candidate.probationStartDate)} → {formatHrDate(candidate.probationEndDate)}</p></div>
        <div>
          <span className="text-gray-400">Hợp đồng</span>
          <div className="mt-1">
            {latestContract ? (
              <button type="button" disabled={disabled} onClick={() => onDownload(latestContract)} className="inline-flex items-center gap-1 text-blue-700 disabled:opacity-50">
                <Download className="h-3.5 w-3.5" /> {latestContract.contractNo}/{latestContract.contractYear}
              </button>
            ) : <span className="text-gray-500">Chưa tạo</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="flex-1 min-w-[90px]" size="sm" variant="secondary" disabled={disabled} onClick={() => onEdit(candidate)}><PencilLine className="mr-1 h-3.5 w-3.5" />Sửa</Button>
        {canGenerate && <Button type="button" className="flex-1 min-w-[90px]" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'generate')}><FileText className="mr-1 h-3.5 w-3.5" />HĐ thử việc</Button>}
        {canStart && <Button type="button" className="flex-1 min-w-[90px]" size="sm" variant="secondary" disabled={disabled} onClick={() => onAction(candidate, 'start')}><PlayCircle className="mr-1 h-3.5 w-3.5" />Bắt đầu</Button>}
        {canPass && <Button type="button" className="flex-1 min-w-[90px]" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'pass')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Đạt</Button>}
        {canFail && <Button type="button" className="flex-1 min-w-[90px]" size="sm" variant="danger" disabled={disabled} onClick={() => onAction(candidate, 'fail')}><XCircle className="mr-1 h-3.5 w-3.5" />Không đạt</Button>}
        {canOnboard && <Button type="button" className="flex-1 min-w-[110px]" size="sm" disabled={disabled} onClick={() => onAction(candidate, 'onboarding')}><UserCheck className="mr-1 h-3.5 w-3.5" />HĐ chính thức</Button>}
      </div>
    </div>
  );
}

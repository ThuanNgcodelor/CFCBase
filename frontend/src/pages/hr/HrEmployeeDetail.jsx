import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Contact,
  FilePenLine,
  FileText,
  Fingerprint,
  FolderOpen,
  HeartPulse,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { HrError, HrLoading, HrPageHeader, HrPageShell, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { ContractExportButton } from '../../components/hr/HrEmploymentContractFields';
import { HrEmployeeDocumentsTab } from '../../components/hr/HrEmployeeDocumentsTab';
import { hrEmploymentContractApi } from '../../api/hrEmploymentContractApi';
import { hrEmployeeDocumentApi } from '../../api/hrEmployeeDocumentApi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, formatHrDateTime, nonEmpty } from '../../utils/hr';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';
import { contractTypeLabel } from '../../utils/hrOnboarding';

const GENDER_LABELS = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNKNOWN: 'Chưa xác định' };
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(numeric);
}

function DetailSection({ icon: Icon, title, note, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-4 w-4" /></div>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{nonEmpty(value)}</dd>
    </div>
  );
}

export default function HrEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'documents' ? 'documents' : 'info';
  const currentYear = new Date().getFullYear();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [exportingContract, setExportingContract] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [leaveYear, setLeaveYear] = useState(currentYear);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveData, setLeaveData] = useState(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ manualOverrideDays: '', note: '' });

  useEffect(() => {
    if (!id) return;
    hrEmployeeDocumentApi.getDocuments(id)
      .then((docs) => setDocumentCount(Array.isArray(docs) ? docs.length : 0))
      .catch(() => {});
  }, [id, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrEmployeeApi.getEmployee(id, { signal: controller.signal })
      .then(setEmployee)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải hồ sơ nhân sự.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  useEffect(() => {
    if (!employee?.id) return undefined;
    const controller = new AbortController();
    setLeaveLoading(true);
    setLeaveError('');
    hrActivityApi.getLeaveEntitlement(employee.id, leaveYear, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setLeaveData(data);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setLeaveError(apiErrorMessage(requestError, 'Không thể tải ngày nghỉ phép năm.'));
          setLeaveData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLeaveLoading(false);
      });

    return () => controller.abort();
  }, [employee?.id, leaveYear]);

  if (loading) {
    return (
      <HrPageShell size="standard">
        <HrLoading label="Đang tải hồ sơ nhân sự..." />
      </HrPageShell>
    );
  }

  if (error || !employee) {
    return (
      <HrPageShell size="standard">
        <HrError message={error || 'Không tìm thấy thông tin nhân sự'} onRetry={() => setReloadKey((value) => value + 1)} />
      </HrPageShell>
    );
  }

  const personal = employee.personal || employee;
  const employment = employee.employment || employee;
  const identity = employee.identity || {};
  const insurance = employee.insurance || {};
  const contact = employee.contact || employee.contacts || {};
  const employmentStatus = employee.employmentStatus || personal.employmentStatus || employee.status;
  const currentContract = employee.currentContract;
  const canDeleteDraft = employmentStatus === 'DRAFT' && employee.onboardingSource !== 'PROBATION';
  const workforceLabel = employee.workforceGroup === 'OFFICE'
    ? 'Khối văn phòng'
    : employee.workforceGroup === 'GENERAL_LABOR'
      ? 'Lao động phổ thông'
      : (employee.workforceType === 'OFFICE' ? 'Khối văn phòng' : employee.workforceType === 'FACTORY' ? 'Khối nhà máy' : '—');
  const previewFinalDays = leaveForm.manualOverrideDays === ''
    ? leaveData?.calculatedDays
    : leaveForm.manualOverrideDays;

  const openLeaveModal = () => {
    if (!leaveData) {
      toast.error('Chưa có dữ liệu ngày phép để chỉnh.');
      return;
    }
    setLeaveForm({
      manualOverrideDays: leaveData.manualOverrideDays ?? '',
      note: leaveData.note || '',
    });
    setLeaveModalOpen(true);
  };

  const closeLeaveModal = () => {
    if (leaveSaving) return;
    setLeaveModalOpen(false);
    setLeaveForm({ manualOverrideDays: '', note: '' });
  };

  const deleteDraft = async () => {
    if (!window.confirm(`Xóa vĩnh viễn hồ sơ nháp ${personal.fullName}? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await hrEmployeeApi.deleteDraftEmployee(id, employee.rowVersion);
      toast.success('Đã xóa hồ sơ nhân sự nháp.');
      navigate('/manager/hr/employees', { replace: true });
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xóa hồ sơ nhân sự nháp.'));
      setReloadKey((value) => value + 1);
    } finally {
      setDeleting(false);
    }
  };

  const exportEmploymentContract = async () => {
    if (!currentContract?.id) return;
    setExportingContract(true);
    try {
      const document = await hrEmploymentContractApi.generateDocument(currentContract.id);
      const response = await hrEmploymentContractApi.downloadDocument(document.id);
      downloadResponseBlob(response, document.generatedFileName || `hop-dong-lao-dong-${employee.employeeCode || personal.employeeCode || 'nhan-su'}.docx`);
      toast.success('Đã tải hợp đồng lao động chính thức.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xuất hợp đồng lao động.'));
    } finally {
      setExportingContract(false);
    }
  };

  const saveLeaveEntitlement = async (event) => {
    event.preventDefault();
    if (!leaveData) return;
    setLeaveSaving(true);
    try {
      const updated = await hrActivityApi.updateLeaveEntitlement(employee.id, {
        leaveYear: leaveData.leaveYear,
        rowVersion: leaveData.rowVersion ?? 0,
        manualOverrideDays: leaveForm.manualOverrideDays === '' ? null : Number(leaveForm.manualOverrideDays),
        note: leaveForm.note.trim() || null,
      });
      setLeaveData(updated);
      toast.success(`Đã cập nhật ngày phép năm ${leaveData.leaveYear}.`);
      closeLeaveModal();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu ngày nghỉ phép.'));
    } finally {
      setLeaveSaving(false);
    }
  };

  return (
    <HrPageShell size="standard">
      <SEOHead title={personal.fullName || 'Chi tiết nhân sự'} />
      <HrPageHeader
        title={personal.fullName || 'Chi tiết nhân sự'}
        description={`Mã nhân sự: ${personal.employeeCode || employee.employeeCode || '—'}`}
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/employees')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách</Button>
            <Button
              type="button"
              variant={activeTab === 'documents' ? 'primary' : 'secondary'}
              onClick={() => setSearchParams({ tab: 'documents' })}
            >
              <FolderOpen className="mr-1.5 h-4 w-4" />Hồ sơ đính kèm
              {documentCount > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {documentCount}
                </span>
              )}
            </Button>
            {currentContract && (
              <ContractExportButton disabled={exportingContract} loading={exportingContract} onClick={exportEmploymentContract} />
            )}
            <Button type="button" onClick={() => navigate(`/manager/hr/employees/${id}/edit`)}>
              <FilePenLine className="mr-1.5 h-4 w-4" />Chỉnh sửa thông tin
            </Button>
            {canDeleteDraft && (
              <Button type="button" variant="danger" disabled={deleting} onClick={deleteDraft}><Trash2 className="mr-1.5 h-4 w-4" />Xóa bản nháp</Button>
            )}
          </>
        )}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-700">
          {personal.fullName?.charAt(0)?.toUpperCase() || <UserRound className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{personal.fullName}</p>
            <HrStatusBadge status={employmentStatus} label={employmentStatusLabel(employmentStatus)} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {employment.department?.name || employment.departmentName || 'Chưa có phòng ban'} · {employment.position?.name || employment.positionName || 'Chưa có chức vụ'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <ShieldCheck className="h-4 w-4" />Đang hiển thị đầy đủ cho Manager
        </div>
      </div>

      {/* Tabs navigation bar */}
      <div className="mb-6 flex border-b border-gray-200 bg-white rounded-t-xl px-2 shadow-sm">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'info' })}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'info'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          <UserRound className="h-4 w-4" />
          Thông tin chi tiết
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'documents' })}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'documents'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          Hồ sơ & Giấy tờ đính kèm
          {documentCount > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {documentCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'info' && (
        <>
          {employmentStatus !== 'DRAFT' && (
            <div className="mb-5">
              <HrReadOnlyNotice>
                Đây là hồ sơ chính thức và được mở ở chế độ tra cứu.
              </HrReadOnlyNotice>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <DetailSection icon={UserRound} title="Thông tin chung">
              <DetailItem label="Họ và tên" value={personal.fullName} />
              <DetailItem label="Giới tính" value={GENDER_LABELS[personal.gender] || personal.gender} />
              <DetailItem label="Ngày sinh" value={formatHrDate(personal.dateOfBirth)} />
              <DetailItem label="Dân tộc" value={personal.ethnicity} />
              <DetailItem label="Tôn giáo" value={personal.religion} />
              <DetailItem label="Trình độ" value={personal.educationLevel} />
              <DetailItem label="Chuyên ngành" value={personal.major} />
              <DetailItem label="Nơi sinh trước sáp nhập" value={personal.birthPlaceOriginal} wide />
              <DetailItem label="Nơi sinh hiện tại" value={personal.birthPlaceCurrent} wide />
            </DetailSection>

            <DetailSection icon={BriefcaseBusiness} title="Công việc">
              <DetailItem label="Nhóm nhân sự" value={workforceLabel} />
              <DetailItem label="Nguồn tiếp nhận" value={employee.onboardingSource} />
              <DetailItem label="Phòng ban" value={employment.department?.name || employment.departmentName} />
              <DetailItem label="Chức vụ" value={employment.position?.name || employment.positionName} />
              <DetailItem label="Điều kiện lao động" value={employment.workingCondition?.name || employment.workingConditionName} />
              <DetailItem label="Ngày vào làm" value={formatHrDate(employment.hireDate)} />
              <DetailItem label="Mốc tính phép" value={formatHrDate(employment.leaveAccrualStartDate)} />
              <DetailItem label="Ngày nghỉ việc" value={formatHrDate(employment.terminationDate)} />
              <DetailItem label="Loại hợp đồng" value={employment.contractTypeLabel} />
              <DetailItem label="Số hợp đồng" value={employment.contractNumber} />
              <DetailItem label="Lương cơ bản" value={formatMoney(employment.baseSalary)} />
              <DetailItem label="Phụ cấp" value={formatMoney(employment.allowance)} />
              <DetailItem label="Mô tả công việc" value={employment.jobDescription} wide />
            </DetailSection>

            {currentContract && (
              <DetailSection icon={FileText} title="Hợp đồng lao động chính thức" note="Mỗi lần xuất tạo một bản DOCX lưu vết riêng, không ghi đè bản đã sinh trước đó.">
                <DetailItem label="Loại hợp đồng" value={contractTypeLabel(currentContract.contractType)} />
                <DetailItem label="Số hợp đồng" value={currentContract.contractNumber} />
                <DetailItem label="Ngày ký" value={formatHrDate(currentContract.signDate)} />
                <DetailItem label="Hiệu lực từ" value={formatHrDate(currentContract.effectiveFrom)} />
                <DetailItem label="Hiệu lực đến" value={currentContract.effectiveUntil ? formatHrDate(currentContract.effectiveUntil) : 'Không xác định thời hạn'} />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Trạng thái</dt>
                  <dd className="mt-1.5"><HrStatusBadge status={currentContract.status} label={currentContract.status === 'EFFECTIVE' ? 'Đang hiệu lực' : 'Chờ tăng nhân sự'} /></dd>
                </div>
              </DetailSection>
            )}

            <DetailSection icon={CalendarDays} title="Ngày phép năm" note="Số cuối cùng sẽ được dùng cho export tháng và export năm.">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Năm áp dụng</dt>
                <dd className="mt-1.5">
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={leaveYear}
                    onChange={(event) => setLeaveYear(Number(event.target.value) || currentYear)}
                    className={INPUT_CLASS}
                  />
                </dd>
              </div>
              <DetailItem label="Điều kiện lao động" value={leaveLoading ? 'Đang tải...' : leaveData?.workingConditionName} />
              <DetailItem label="Ngày phép nền" value={leaveLoading ? 'Đang tải...' : leaveData?.baseDays} />
              <DetailItem label="Thâm niên cộng thêm" value={leaveLoading ? 'Đang tải...' : leaveData?.seniorityBonusDays} />
              <DetailItem label="Tự tính" value={leaveLoading ? 'Đang tải...' : leaveData?.calculatedDays} />
              <DetailItem label="Số cuối cùng" value={leaveLoading ? 'Đang tải...' : leaveData?.finalDays} />
              <DetailItem label="Chỉnh tay" value={leaveLoading ? 'Đang tải...' : (leaveData?.manualOverrideDays ?? 'Không')} />
              <DetailItem label="Ghi chú" value={leaveLoading ? 'Đang tải...' : leaveData?.note} wide />
              <div className="sm:col-span-2">
                {leaveError ? (
                  <HrError message={leaveError} onRetry={() => setLeaveYear((value) => value)} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-sm text-emerald-800">
                      Hệ thống tự lấy ngày phép nền từ điều kiện lao động và cộng thâm niên mỗi 5 năm. Nếu cần, bạn có thể chỉnh tay cho riêng nhân sự này.
                    </p>
                    <Button type="button" onClick={openLeaveModal} disabled={leaveLoading || !leaveData}>
                      Sửa ngày phép năm
                    </Button>
                  </div>
                )}
              </div>
            </DetailSection>

            <DetailSection icon={Fingerprint} title="Định danh" note="Hiển thị đầy đủ để Manager đối chiếu hồ sơ.">
              <DetailItem label="CMND cũ" value={identity.legacyIdentityNumber} />
              <DetailItem label="CCCD" value={identity.citizenIdentityNumber} />
              <DetailItem label="Ngày cấp" value={formatHrDate(identity.issuedDate)} />
              <DetailItem label="Nơi cấp" value={identity.issuedPlace} />
            </DetailSection>

            <DetailSection icon={HeartPulse} title="Bảo hiểm" note="Hiển thị đầy đủ để Manager đối chiếu hồ sơ.">
              <DetailItem label="Số BHXH" value={insurance.socialInsuranceNumber} />
              <DetailItem label="Số BHYT" value={insurance.healthInsuranceNumber} />
              <DetailItem label="Hiệu lực từ" value={formatHrDate(insurance.validFrom)} />
              <DetailItem label="Hiệu lực đến" value={formatHrDate(insurance.validUntil)} />
            </DetailSection>

            <DetailSection icon={Contact} title="Liên hệ" note="Hiển thị đầy đủ để Manager đối chiếu hồ sơ.">
              <DetailItem label="Điện thoại" value={contact.phone} />
              <DetailItem label="Email công việc" value={contact.workEmail} />
              <DetailItem label="Email cá nhân" value={contact.personalEmail} />
              <DetailItem label="Địa chỉ thường trú" value={contact.permanentAddress} wide />
              <DetailItem label="Địa chỉ hiện tại" value={contact.currentAddress} wide />
              <DetailItem label="Liên hệ khẩn cấp" value={contact.emergencyContactName} />
              <DetailItem label="Quan hệ" value={contact.emergencyContactRelation} />
              <DetailItem label="SĐT khẩn cấp" value={contact.emergencyContactPhone} />
            </DetailSection>

            <DetailSection icon={FilePenLine} title="Theo dõi thay đổi">
              <DetailItem label="Phiên bản dữ liệu" value={employee.rowVersion ?? employee.version} />
              <DetailItem label="Cập nhật lúc" value={formatHrDateTime(employee.updatedAt)} />
              <DetailItem label="Tạo lúc" value={formatHrDateTime(employee.createdAt)} />
              <DetailItem label="Hiệu lực trạng thái" value={formatHrDate(personal.statusEffectiveDate || employee.statusEffectiveDate)} />
            </DetailSection>
          </div>
        </>
      )}

      {activeTab === 'documents' && (
        <HrEmployeeDocumentsTab
          employeeId={id}
          employeeName={personal.fullName}
          onDocumentCountChange={setDocumentCount}
        />
      )}

      <Modal isOpen={leaveModalOpen} onClose={closeLeaveModal} title={`Ngày phép ${personal.fullName || ''} - ${leaveYear}`}>
        {leaveData ? (
          <form onSubmit={saveLeaveEntitlement} className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Năm</p><p className="mt-1 font-semibold text-gray-800">{leaveData.leaveYear}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Điều kiện lao động</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.workingConditionName)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Ngày phép nền</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.baseDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Thâm niên cộng thêm</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.seniorityBonusDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Tự tính</p><p className="mt-1 font-semibold text-emerald-700">{nonEmpty(leaveData.calculatedDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Số cuối cùng</p><p className="mt-1 font-semibold text-blue-700">{nonEmpty(previewFinalDays)}</p></div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Chỉnh tay ngày phép</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={leaveForm.manualOverrideDays}
                onChange={(event) => setLeaveForm((current) => ({ ...current, manualOverrideDays: event.target.value }))}
                className={INPUT_CLASS}
                placeholder="Để trống để dùng số tự tính"
              />
              <span className="text-xs text-gray-500">Ví dụ hệ thống tính 16, bạn có thể nhập 15.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Ghi chú</span>
              <textarea
                value={leaveForm.note}
                onChange={(event) => setLeaveForm((current) => ({ ...current, note: event.target.value }))}
                className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-emerald-500 sm:text-sm"
                placeholder="Ví dụ: điều chỉnh theo quyết định nội bộ"
              />
            </label>
            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLeaveForm((current) => ({ ...current, manualOverrideDays: '', note: '' }))}
                disabled={leaveSaving}
              >
                Trả về tự động
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={closeLeaveModal} disabled={leaveSaving}>Hủy</Button>
                <Button type="submit" disabled={leaveSaving}>{leaveSaving ? 'Đang lưu...' : 'Lưu ngày phép'}</Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="py-8 text-center text-sm text-gray-500">Chưa có dữ liệu ngày phép.</div>
        )}
      </Modal>
    </HrPageShell>
  );
}

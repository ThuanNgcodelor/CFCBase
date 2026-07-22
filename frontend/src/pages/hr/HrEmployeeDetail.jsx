import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, Contact, FilePenLine, Fingerprint, HeartPulse, ShieldCheck, UserRound } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrError, HrLoading, HrPageHeader, HrStatusBadge } from '../../components/hr/HrUi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { apiErrorMessage, formatHrDate, formatHrDateTime, nonEmpty } from '../../utils/hr';

const GENDER_LABELS = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNKNOWN: 'Chưa xác định' };

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
      <dd className="mt-1.5 break-words text-sm text-gray-800">{nonEmpty(value)}</dd>
    </div>
  );
}

export default function HrEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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

  if (loading) return <HrLoading label="Đang tải hồ sơ nhân sự..." />;
  if (error) return <HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  if (!employee) return <HrError message="Không tìm thấy hồ sơ nhân sự." />;

  const personal = employee.personal || employee;
  const employment = employee.employment || employee;
  const identity = employee.identity || {};
  const insurance = employee.insurance || {};
  const contact = employee.contact || employee.contacts || {};
  const employmentStatus = employee.employmentStatus || personal.employmentStatus || employee.status;

  return (
    <div className="w-full max-w-6xl">
      <SEOHead title={`CFC Base | ${personal.fullName || 'Chi tiết nhân sự'}`} url={`https://cfcbooking.io.vn/manager/hr/employees/${id}`} />
      <HrPageHeader
        title={personal.fullName || 'Chi tiết nhân sự'}
        description={`Mã nhân sự: ${employee.employeeCode || personal.employeeCode || '—'}`}
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/employees')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách</Button>
            {employmentStatus === 'DRAFT' && (
              <Button type="button" onClick={() => navigate(`/manager/hr/employees/${id}/edit`)}><FilePenLine className="mr-1.5 h-4 w-4" />Chỉnh sửa bản nháp</Button>
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
            <HrStatusBadge status={employmentStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{employment.departmentName || employment.department?.name || 'Chưa có phòng ban'} · {employment.positionName || employment.position?.name || 'Chưa có chức vụ'}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <ShieldCheck className="h-4 w-4" />Thông tin nhạy cảm đã được server che
        </div>
      </div>

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
          <DetailItem label="Phòng ban" value={employment.departmentName || employment.department?.name} />
          <DetailItem label="Chức vụ" value={employment.positionName || employment.position?.name} />
          <DetailItem label="Điều kiện lao động" value={employment.workingConditionName || employment.workingCondition?.name} />
          <DetailItem label="Ngày vào làm" value={formatHrDate(employment.hireDate)} />
          <DetailItem label="Mốc tính phép" value={formatHrDate(employment.leaveAccrualStartDate)} />
          <DetailItem label="Ngày nghỉ việc" value={formatHrDate(employment.terminationDate)} />
          <DetailItem label="Loại hợp đồng" value={employment.contractTypeLabel} />
          <DetailItem label="Số hợp đồng" value={employment.contractNumber} />
          <DetailItem label="Lương / phụ cấp" value={employment.hasCompensationData ? 'Đã lưu (không hiển thị giá trị)' : 'Chưa có dữ liệu'} />
          <DetailItem label="Mô tả công việc" value={employment.jobDescription} wide />
        </DetailSection>

        <DetailSection icon={Fingerprint} title="Định danh" note="Giá trị trả về là dữ liệu đã mask, không có thao tác hiện số đầy đủ.">
          <DetailItem label="CMND cũ" value={identity.legacyIdentityNumberMasked || identity.legacyIdentityNumber} />
          <DetailItem label="CCCD" value={identity.citizenIdentityNumberMasked || identity.citizenIdentityNumber} />
          <DetailItem label="Ngày cấp" value={formatHrDate(identity.issuedDate)} />
          <DetailItem label="Nơi cấp" value={identity.issuedPlace} />
          <DetailItem label="Xác minh" value={identity.verificationStatusLabel || identity.verificationStatus} />
        </DetailSection>

        <DetailSection icon={HeartPulse} title="Bảo hiểm" note="Mã BHXH/BHYT được che tại API.">
          <DetailItem label="Số BHXH" value={insurance.socialInsuranceNumberMasked || insurance.socialInsuranceNumber} />
          <DetailItem label="Số BHYT" value={insurance.healthInsuranceNumberMasked || insurance.healthInsuranceNumber} />
          <DetailItem label="Hiệu lực từ" value={formatHrDate(insurance.validFrom)} />
          <DetailItem label="Hiệu lực đến" value={formatHrDate(insurance.validUntil)} />
          <DetailItem label="Trạng thái" value={insurance.statusLabel || insurance.status} />
        </DetailSection>

        <DetailSection icon={Contact} title="Liên hệ" note="Điện thoại và địa chỉ được mask theo chính sách API.">
          <DetailItem label="Điện thoại" value={contact.phoneMasked || contact.phone} />
          <DetailItem label="Email công việc" value={contact.workEmailMasked || contact.workEmail} />
          <DetailItem label="Email cá nhân" value={contact.personalEmailMasked || contact.personalEmail} />
          <DetailItem label="Địa chỉ thường trú" value={contact.permanentAddressMasked || contact.permanentAddress} wide />
          <DetailItem label="Địa chỉ hiện tại" value={contact.currentAddressMasked || contact.currentAddress} wide />
          <DetailItem label="Liên hệ khẩn cấp" value={contact.emergencyContactName} />
          <DetailItem label="Quan hệ" value={contact.emergencyContactRelation} />
          <DetailItem label="SĐT khẩn cấp" value={contact.emergencyContactPhoneMasked || contact.emergencyContactPhone} />
        </DetailSection>

        <DetailSection icon={FilePenLine} title="Theo dõi thay đổi">
          <DetailItem label="Phiên bản dữ liệu" value={employee.rowVersion ?? employee.version} />
          <DetailItem label="Cập nhật lúc" value={formatHrDateTime(employee.updatedAt)} />
          <DetailItem label="Tạo lúc" value={formatHrDateTime(employee.createdAt)} />
          <DetailItem label="Hiệu lực trạng thái" value={formatHrDate(personal.statusEffectiveDate || employee.statusEffectiveDate)} />
        </DetailSection>
      </div>
    </div>
  );
}

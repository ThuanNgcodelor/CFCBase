import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrError, HrLoading, HrPageHeader, HrReadOnlyNotice } from '../../components/hr/HrUi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { apiErrorMessage } from '../../utils/hr';

const EMPTY_FORM = {
  personal: {
    employeeCode: '', fullName: '', gender: 'UNKNOWN', dateOfBirth: '', ethnicity: '', religion: '',
    birthPlaceOriginal: '', birthPlaceCurrent: '', educationLevel: '', major: '',
  },
  employment: {
    departmentId: '', positionId: '', workingConditionId: '', hireDate: '', leaveAccrualStartDate: '',
    terminationDate: '', contractTypeLabel: '', contractNumber: '', baseSalary: '', allowance: '', jobDescription: '',
  },
  identity: { legacyIdentityNumber: '', citizenIdentityNumber: '', issuedDate: '', issuedPlace: '', verificationStatus: 'UNVERIFIED' },
  insurance: { socialInsuranceNumber: '', healthInsuranceNumber: '', validFrom: '', validUntil: '', status: 'UNKNOWN' },
  contact: {
    permanentAddress: '', currentAddress: '', phone: '', workEmail: '', personalEmail: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  },
};

function fieldValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function formFromEmployee(employee) {
  const personal = employee.personal || employee;
  const employment = employee.employment || employee;
  const identity = employee.identity || {};
  const insurance = employee.insurance || {};
  const contact = employee.contact || employee.contacts || {};
  return {
    personal: {
      employeeCode: fieldValue(personal.employeeCode || employee.employeeCode),
      fullName: fieldValue(personal.fullName || employee.fullName),
      gender: personal.gender || 'UNKNOWN',
      dateOfBirth: fieldValue(personal.dateOfBirth),
      ethnicity: fieldValue(personal.ethnicity),
      religion: fieldValue(personal.religion),
      birthPlaceOriginal: fieldValue(personal.birthPlaceOriginal),
      birthPlaceCurrent: fieldValue(personal.birthPlaceCurrent),
      educationLevel: fieldValue(personal.educationLevel),
      major: fieldValue(personal.major),
    },
    employment: {
      departmentId: fieldValue(employment.departmentId || employment.department?.id),
      positionId: fieldValue(employment.positionId || employment.position?.id),
      workingConditionId: fieldValue(employment.workingConditionId || employment.workingCondition?.id),
      hireDate: fieldValue(employment.hireDate),
      leaveAccrualStartDate: fieldValue(employment.leaveAccrualStartDate),
      terminationDate: fieldValue(employment.terminationDate),
      contractTypeLabel: fieldValue(employment.contractTypeLabel),
      contractNumber: fieldValue(employment.contractNumber),
      baseSalary: fieldValue(employment.baseSalary),
      allowance: fieldValue(employment.allowance),
      jobDescription: fieldValue(employment.jobDescription),
    },
    identity: {
      legacyIdentityNumber: fieldValue(identity.legacyIdentityNumber),
      citizenIdentityNumber: fieldValue(identity.citizenIdentityNumber),
      issuedDate: fieldValue(identity.issuedDate), issuedPlace: fieldValue(identity.issuedPlace),
      verificationStatus: identity.verificationStatus || 'UNVERIFIED',
    },
    insurance: {
      socialInsuranceNumber: fieldValue(insurance.socialInsuranceNumber),
      healthInsuranceNumber: fieldValue(insurance.healthInsuranceNumber),
      validFrom: fieldValue(insurance.validFrom),
      validUntil: fieldValue(insurance.validUntil), status: insurance.status || 'UNKNOWN',
    },
    contact: {
      permanentAddress: fieldValue(contact.permanentAddress),
      currentAddress: fieldValue(contact.currentAddress),
      phone: fieldValue(contact.phone),
      workEmail: fieldValue(contact.workEmail),
      personalEmail: fieldValue(contact.personalEmail),
      emergencyContactName: fieldValue(contact.emergencyContactName),
      emergencyContactPhone: fieldValue(contact.emergencyContactPhone),
      emergencyContactRelation: fieldValue(contact.emergencyContactRelation),
    },
  };
}

function normalizeSection(section, { omitEmpty = [] } = {}) {
  return Object.fromEntries(Object.entries(section)
    .filter(([key, value]) => !(omitEmpty.includes(key) && value === ''))
    .map(([key, value]) => [key, value === '' ? null : value]));
}

function FormSection({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, wide = false, children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLASS = 'h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const TEXTAREA_CLASS = 'min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function HrEmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rowVersion, setRowVersion] = useState(null);
  const [employeeStatus, setEmployeeStatus] = useState('DRAFT');
  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
    ]).then(([departments, positions, conditions]) => {
      setCatalogs({
        departments,
        positions,
        conditions,
      });
    }).catch((requestError) => {
      if (!controller.signal.aborted) {
        setCatalogError(apiErrorMessage(requestError, 'Không thể tải đầy đủ phòng ban, chức vụ và điều kiện lao động.'));
      }
    });
    return () => controller.abort();
  }, [catalogReloadKey]);

  useEffect(() => {
    if (!isEdit) return undefined;
    const controller = new AbortController();
    setLoading(true);
    hrEmployeeApi.getEmployee(id, { signal: controller.signal })
      .then((employee) => {
        const status = employee.employmentStatus || employee.personal?.employmentStatus || employee.status;
        setEmployeeStatus(status);
        setRowVersion(employee.rowVersion ?? employee.version);
        setForm(formFromEmployee(employee));
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải hồ sơ cần chỉnh sửa.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isEdit]);

  const update = (section, field, value) => {
    setForm((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const omitSensitiveEmpty = isEdit
      ? {
          employment: ['baseSalary', 'allowance'],
          identity: ['legacyIdentityNumber', 'citizenIdentityNumber'],
          insurance: ['socialInsuranceNumber', 'healthInsuranceNumber'],
          contact: [
            'permanentAddress', 'currentAddress', 'phone', 'workEmail', 'personalEmail',
            'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
          ],
        }
      : {};
    const payload = {
      personal: normalizeSection(form.personal),
      employment: normalizeSection(form.employment, { omitEmpty: omitSensitiveEmpty.employment }),
      identity: normalizeSection(form.identity, { omitEmpty: omitSensitiveEmpty.identity }),
      insurance: normalizeSection(form.insurance, { omitEmpty: omitSensitiveEmpty.insurance }),
      contact: normalizeSection(form.contact, { omitEmpty: omitSensitiveEmpty.contact }),
      ...(isEdit ? { rowVersion } : {}),
    };

    setSaving(true);
    try {
      const saved = isEdit
        ? await hrEmployeeApi.updateEmployee(id, payload)
        : await hrEmployeeApi.createEmployee(payload);
      toast.success(isEdit ? 'Đã cập nhật hồ sơ nháp' : 'Đã tạo hồ sơ nháp');
      navigate(`/manager/hr/employees/${saved?.id || id}`, { replace: true });
    } catch (requestError) {
      const message = apiErrorMessage(requestError, isEdit ? 'Không thể cập nhật hồ sơ.' : 'Không thể tạo hồ sơ.');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <HrLoading label="Đang tải biểu mẫu..." />;
  if (error && isEdit && !form.personal.fullName) return <HrError message={error} />;
  if (isEdit && employeeStatus !== 'DRAFT') {
    return (
      <div className="max-w-3xl">
        <HrError message="Chỉ hồ sơ nháp mới được chỉnh sửa trực tiếp. Hồ sơ chính thức cần thay đổi qua nghiệp vụ Tăng/Giảm để giữ lịch sử." />
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate(`/manager/hr/employees/${id}`)}>Quay lại chi tiết</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <SEOHead title={`CFC Base | ${isEdit ? 'Chỉnh sửa' : 'Thêm'} hồ sơ nhân sự`} />
      <HrPageHeader
        title={isEdit ? 'Chỉnh sửa hồ sơ nháp' : 'Thêm hồ sơ nhân sự'}
        description="Hồ sơ mới luôn được lưu ở trạng thái Hồ sơ nháp. Việc đưa vào danh sách chính thức sẽ được xử lý qua nghiệp vụ Tăng/Giảm."
        actions={<Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/manager/hr/employees/${id}` : '/manager/hr/employees')}><ArrowLeft className="mr-1.5 h-4 w-4" />Quay lại</Button>}
      />

      {isEdit && (
        <div className="mb-4">
          <HrReadOnlyNotice>
            Form đang hiển thị đầy đủ dữ liệu hồ sơ nháp để Manager kiểm tra và chỉnh sửa. Field nhạy cảm để trống sẽ giữ nguyên dữ liệu cũ.
          </HrReadOnlyNotice>
        </div>
      )}
      {catalogError && (
        <div className="mb-4">
          <HrError message={catalogError} onRetry={() => setCatalogReloadKey((value) => value + 1)} />
        </div>
      )}
      {error && <div className="mb-4"><HrError message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Thông tin chung">
          <Field label="Mã nhân sự *"><input required maxLength={32} value={form.personal.employeeCode} onChange={(e) => update('personal', 'employeeCode', e.target.value.toUpperCase())} className={INPUT_CLASS} /></Field>
          <Field label="Họ và tên *"><input required maxLength={255} value={form.personal.fullName} onChange={(e) => update('personal', 'fullName', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Giới tính"><select value={form.personal.gender} onChange={(e) => update('personal', 'gender', e.target.value)} className={INPUT_CLASS}><option value="UNKNOWN">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
          <Field label="Ngày sinh"><input type="date" value={form.personal.dateOfBirth} onChange={(e) => update('personal', 'dateOfBirth', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Dân tộc"><input value={form.personal.ethnicity} onChange={(e) => update('personal', 'ethnicity', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Tôn giáo"><input value={form.personal.religion} onChange={(e) => update('personal', 'religion', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Trình độ"><input value={form.personal.educationLevel} onChange={(e) => update('personal', 'educationLevel', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Chuyên ngành"><input value={form.personal.major} onChange={(e) => update('personal', 'major', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Nơi sinh trước sáp nhập" wide><input value={form.personal.birthPlaceOriginal} onChange={(e) => update('personal', 'birthPlaceOriginal', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Nơi sinh hiện tại" wide><input value={form.personal.birthPlaceCurrent} onChange={(e) => update('personal', 'birthPlaceCurrent', e.target.value)} className={INPUT_CLASS} /></Field>
        </FormSection>

        <FormSection title="Công việc và hợp đồng">
          <Field label="Phòng ban HR"><select value={form.employment.departmentId} onChange={(e) => update('employment', 'departmentId', e.target.value)} className={INPUT_CLASS}><option value="">Chưa chọn</option>{catalogs.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Chức vụ HR"><select value={form.employment.positionId} onChange={(e) => update('employment', 'positionId', e.target.value)} className={INPUT_CLASS}><option value="">Chưa chọn</option>{catalogs.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Điều kiện lao động"><select value={form.employment.workingConditionId} onChange={(e) => update('employment', 'workingConditionId', e.target.value)} className={INPUT_CLASS}><option value="">Chưa chọn</option>{catalogs.conditions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Ngày vào làm"><input type="date" value={form.employment.hireDate} onChange={(e) => update('employment', 'hireDate', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Mốc tính phép"><input type="date" value={form.employment.leaveAccrualStartDate} onChange={(e) => update('employment', 'leaveAccrualStartDate', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Ngày nghỉ việc"><input type="date" value={form.employment.terminationDate} onChange={(e) => update('employment', 'terminationDate', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Loại hợp đồng"><input value={form.employment.contractTypeLabel} onChange={(e) => update('employment', 'contractTypeLabel', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Số hợp đồng"><input value={form.employment.contractNumber} onChange={(e) => update('employment', 'contractNumber', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label={isEdit ? 'Lương cơ bản mới (để trống nếu giữ nguyên)' : 'Lương cơ bản'}><input type="number" min="0" step="0.01" value={form.employment.baseSalary} onChange={(e) => update('employment', 'baseSalary', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label={isEdit ? 'Phụ cấp mới (để trống nếu giữ nguyên)' : 'Phụ cấp'}><input type="number" min="0" step="0.01" value={form.employment.allowance} onChange={(e) => update('employment', 'allowance', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Mô tả công việc" wide><textarea value={form.employment.jobDescription} onChange={(e) => update('employment', 'jobDescription', e.target.value)} className={TEXTAREA_CLASS} /></Field>
        </FormSection>

        <FormSection title="Định danh" description={isEdit ? 'Dữ liệu định danh hiện có được điền sẵn để đối chiếu nhanh.' : undefined}>
          <Field label="CMND cũ"><input inputMode="numeric" value={form.identity.legacyIdentityNumber} onChange={(e) => update('identity', 'legacyIdentityNumber', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="CCCD"><input inputMode="numeric" value={form.identity.citizenIdentityNumber} onChange={(e) => update('identity', 'citizenIdentityNumber', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Ngày cấp"><input type="date" value={form.identity.issuedDate} onChange={(e) => update('identity', 'issuedDate', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Nơi cấp"><input value={form.identity.issuedPlace} onChange={(e) => update('identity', 'issuedPlace', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Xác minh"><select value={form.identity.verificationStatus} onChange={(e) => update('identity', 'verificationStatus', e.target.value)} className={INPUT_CLASS}><option value="UNVERIFIED">Chưa xác minh</option><option value="VERIFIED">Đã xác minh</option><option value="NEEDS_REVIEW">Cần kiểm tra</option></select></Field>
        </FormSection>

        <FormSection title="Bảo hiểm" description={isEdit ? 'Dữ liệu bảo hiểm hiện có được điền sẵn để đối chiếu nhanh.' : undefined}>
          <Field label="Số BHXH"><input value={form.insurance.socialInsuranceNumber} onChange={(e) => update('insurance', 'socialInsuranceNumber', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Số BHYT"><input value={form.insurance.healthInsuranceNumber} onChange={(e) => update('insurance', 'healthInsuranceNumber', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Hiệu lực từ"><input type="date" value={form.insurance.validFrom} onChange={(e) => update('insurance', 'validFrom', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Hiệu lực đến"><input type="date" value={form.insurance.validUntil} onChange={(e) => update('insurance', 'validUntil', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Trạng thái"><select value={form.insurance.status} onChange={(e) => update('insurance', 'status', e.target.value)} className={INPUT_CLASS}><option value="UNKNOWN">Chưa xác định</option><option value="ACTIVE">Đang hiệu lực</option><option value="INACTIVE">Ngừng hiệu lực</option><option value="NEEDS_REVIEW">Cần kiểm tra</option></select></Field>
        </FormSection>

        <FormSection title="Liên hệ" description={isEdit ? 'Thông tin liên hệ hiện có được điền sẵn để đối chiếu nhanh.' : undefined}>
          <Field label="Điện thoại"><input type="tel" value={form.contact.phone} onChange={(e) => update('contact', 'phone', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Email công việc"><input type="email" value={form.contact.workEmail} onChange={(e) => update('contact', 'workEmail', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Email cá nhân"><input type="email" value={form.contact.personalEmail} onChange={(e) => update('contact', 'personalEmail', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Địa chỉ thường trú" wide><textarea value={form.contact.permanentAddress} onChange={(e) => update('contact', 'permanentAddress', e.target.value)} className={TEXTAREA_CLASS} /></Field>
          <Field label="Địa chỉ hiện tại" wide><textarea value={form.contact.currentAddress} onChange={(e) => update('contact', 'currentAddress', e.target.value)} className={TEXTAREA_CLASS} /></Field>
          <Field label="Người liên hệ khẩn cấp"><input value={form.contact.emergencyContactName} onChange={(e) => update('contact', 'emergencyContactName', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="SĐT khẩn cấp"><input type="tel" value={form.contact.emergencyContactPhone} onChange={(e) => update('contact', 'emergencyContactPhone', e.target.value)} className={INPUT_CLASS} /></Field>
          <Field label="Quan hệ"><input value={form.contact.emergencyContactRelation} onChange={(e) => update('contact', 'emergencyContactRelation', e.target.value)} className={INPUT_CLASS} /></Field>
        </FormSection>

        <div className="sticky bottom-3 z-10 flex justify-end rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <Button type="submit" disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ nháp'}</Button>
        </div>
      </form>
    </div>
  );
}

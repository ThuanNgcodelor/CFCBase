import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, HardHat, Save } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrError, HrPageHeader, HrPageShell, HrReadOnlyNotice } from '../../components/hr/HrUi';
import HrEmploymentContractFields, { ContractExportPlaceholderButton } from '../../components/hr/HrEmploymentContractFields';
import {
  HR_INPUT_CLASS,
  HR_TEXTAREA_CLASS,
  HrCatalogSelect,
  HrField,
  HrFormSection,
} from '../../components/hr/HrFormControls';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { hrOnboardingApi } from '../../api/hrOnboardingApi';
import { apiErrorMessage } from '../../utils/hr';
import {
  contractPayload,
  contractTypeLabel,
  createContractForm,
  newIdempotencyKey,
  validateContractForm,
} from '../../utils/hrOnboarding';

const EMPTY_EMPLOYEE = {
  personal: {
    employeeCode: '', fullName: '', gender: 'UNKNOWN', dateOfBirth: '', ethnicity: '', religion: '',
    birthPlaceOriginal: '', birthPlaceCurrent: '', educationLevel: '', major: '',
  },
  employment: {
    departmentId: '', positionId: '', workingConditionId: '', leaveAccrualStartDate: '',
    baseSalary: '', allowance: '', jobDescription: '',
  },
  identity: {
    legacyIdentityNumber: '', citizenIdentityNumber: '', issuedDate: '', issuedPlace: '',
    verificationStatus: 'UNVERIFIED',
  },
  insurance: {
    socialInsuranceNumber: '', healthInsuranceNumber: '', validFrom: '', validUntil: '', status: 'UNKNOWN',
  },
  contact: {
    permanentAddress: '', currentAddress: '', phone: '', workEmail: '', personalEmail: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  },
};

function nullable(value) {
  if (value === undefined || value === null) return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  return normalized === '' ? null : normalized;
}

function nullableMoney(value) {
  const normalized = nullable(value);
  return normalized === null ? null : Number(normalized);
}

function sectionPayload(section) {
  return Object.fromEntries(Object.entries(section).map(([key, value]) => [key, nullable(value)]));
}

export default function HrGeneralLaborOnboarding() {
  const navigate = useNavigate();
  const idempotencyKey = useRef(newIdempotencyKey('general-labor'));
  const [employee, setEmployee] = useState(EMPTY_EMPLOYEE);
  const [contract, setContract] = useState(() => createContractForm());
  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [catalogError, setCatalogError] = useState('');
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
    ])
      .then(([departments, positions, conditions]) => setCatalogs({ departments, positions, conditions }))
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setCatalogError(apiErrorMessage(requestError, 'Không thể tải phòng ban, chức vụ và điều kiện lao động.'));
        }
      });
    return () => controller.abort();
  }, [catalogReloadKey]);

  const update = (section, field, value) => {
    setEmployee((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const contractError = validateContractForm(contract);
    if (contractError) {
      setError(contractError);
      toast.error(contractError);
      return;
    }
    if (!employee.employment.departmentId || !employee.employment.positionId) {
      const message = 'Vui lòng chọn phòng ban và chức vụ.';
      setError(message);
      toast.error(message);
      return;
    }

    const payload = {
      idempotencyKey: idempotencyKey.current,
      employee: {
        personal: sectionPayload(employee.personal),
        employment: {
          departmentId: nullable(employee.employment.departmentId),
          positionId: nullable(employee.employment.positionId),
          workingConditionId: nullable(employee.employment.workingConditionId),
          hireDate: contract.effectiveFrom,
          leaveAccrualStartDate: nullable(employee.employment.leaveAccrualStartDate),
          terminationDate: null,
          contractTypeLabel: contractTypeLabel(contract.contractType),
          contractNumber: contract.contractNumber.trim(),
          baseSalary: nullableMoney(employee.employment.baseSalary),
          allowance: nullableMoney(employee.employment.allowance),
          jobDescription: nullable(employee.employment.jobDescription),
        },
        identity: sectionPayload(employee.identity),
        insurance: sectionPayload(employee.insurance),
        contact: sectionPayload(employee.contact),
      },
      contract: contractPayload(contract),
    };

    setSaving(true);
    setError('');
    try {
      const response = await hrOnboardingApi.createGeneralLabor(payload);
      const savedEmployee = response?.employee;
      toast.success('Đã tạo hồ sơ nháp và lưu thông tin hợp đồng. Tiếp theo: tạo Tăng nhân sự.');
      const params = new URLSearchParams({
        create: 'increase',
        employeeId: savedEmployee?.id || '',
        effectiveDate: contract.effectiveFrom,
      });
      navigate(`/manager/hr/movements?${params.toString()}`, { replace: true });
    } catch (requestError) {
      const message = apiErrorMessage(requestError, 'Không thể tạo hồ sơ lao động phổ thông.');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPageShell size="standard">
      <SEOHead title="CFC Base | Thêm lao động phổ thông" />
      <HrPageHeader
        title="Thêm lao động phổ thông"
        description="Luồng trực tiếp: nhập hồ sơ, chọn hợp đồng 1 năm hoặc không xác định thời hạn, lưu bản nháp rồi tạo Tăng nhân sự."
        actions={(
          <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/general-labor')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Quay lại
          </Button>
        )}
      />

      <div className="mb-4">
        <HrReadOnlyNotice>
          <span className="inline-flex items-center gap-2 font-medium"><HardHat className="h-4 w-4" />Luồng này chỉ dành cho lao động phổ thông và không đi qua thử việc.</span>
          <span className="mt-1 block">Nút xuất hợp đồng đã có sẵn nhưng chưa sinh file vì chưa có mẫu Word chính thức.</span>
        </HrReadOnlyNotice>
      </div>
      {catalogError && <div className="mb-4"><HrError message={catalogError} onRetry={() => setCatalogReloadKey((value) => value + 1)} /></div>}
      {error && <div className="mb-4"><HrError message={error} /></div>}

      <form onSubmit={submit} className="space-y-5">
        <HrFormSection title="Thông tin chung">
          <HrField label="Mã nhân sự *" htmlFor="general-labor-code">
            <input id="general-labor-code" required maxLength={32} value={employee.personal.employeeCode} onChange={(event) => update('personal', 'employeeCode', event.target.value.toUpperCase())} className={HR_INPUT_CLASS} />
          </HrField>
          <HrField label="Họ và tên *" htmlFor="general-labor-name">
            <input id="general-labor-name" required maxLength={255} value={employee.personal.fullName} onChange={(event) => update('personal', 'fullName', event.target.value)} className={HR_INPUT_CLASS} />
          </HrField>
          <HrField label="Giới tính" htmlFor="general-labor-gender">
            <select id="general-labor-gender" value={employee.personal.gender} onChange={(event) => update('personal', 'gender', event.target.value)} className={HR_INPUT_CLASS}>
              <option value="UNKNOWN">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option>
            </select>
          </HrField>
          <HrField label="Ngày sinh" htmlFor="general-labor-birth-date"><input id="general-labor-birth-date" type="date" value={employee.personal.dateOfBirth} onChange={(event) => update('personal', 'dateOfBirth', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Dân tộc"><input value={employee.personal.ethnicity} onChange={(event) => update('personal', 'ethnicity', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Tôn giáo"><input value={employee.personal.religion} onChange={(event) => update('personal', 'religion', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Nơi sinh" wide><input value={employee.personal.birthPlaceCurrent} onChange={(event) => { update('personal', 'birthPlaceCurrent', event.target.value); update('personal', 'birthPlaceOriginal', event.target.value); }} className={HR_INPUT_CLASS} /></HrField>
        </HrFormSection>

        <HrFormSection title="Công việc" description="Ngày vào làm được lấy theo ngày hợp đồng bắt đầu hiệu lực.">
          <HrField label="Phòng ban *" htmlFor="general-labor-department">
            <HrCatalogSelect id="general-labor-department" required value={employee.employment.departmentId} onChange={(value) => update('employment', 'departmentId', value)} items={catalogs.departments} />
          </HrField>
          <HrField label="Chức vụ *" htmlFor="general-labor-position">
            <HrCatalogSelect id="general-labor-position" required value={employee.employment.positionId} onChange={(value) => update('employment', 'positionId', value)} items={catalogs.positions} />
          </HrField>
          <HrField label="Điều kiện lao động" htmlFor="general-labor-condition">
            <HrCatalogSelect id="general-labor-condition" value={employee.employment.workingConditionId} onChange={(value) => update('employment', 'workingConditionId', value)} items={catalogs.conditions} />
          </HrField>
          <HrField label="Mốc tính phép" htmlFor="general-labor-leave-date"><input id="general-labor-leave-date" type="date" value={employee.employment.leaveAccrualStartDate} onChange={(event) => update('employment', 'leaveAccrualStartDate', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Lương cơ bản"><input type="number" min="0" step="0.01" value={employee.employment.baseSalary} onChange={(event) => update('employment', 'baseSalary', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Phụ cấp"><input type="number" min="0" step="0.01" value={employee.employment.allowance} onChange={(event) => update('employment', 'allowance', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Mô tả công việc" wide><textarea value={employee.employment.jobDescription} onChange={(event) => update('employment', 'jobDescription', event.target.value)} className={HR_TEXTAREA_CLASS} /></HrField>
        </HrFormSection>

        <HrEmploymentContractFields value={contract} onChange={setContract} disabled={saving} />

        <HrFormSection title="Định danh">
          <HrField label="CMND cũ"><input inputMode="numeric" value={employee.identity.legacyIdentityNumber} onChange={(event) => update('identity', 'legacyIdentityNumber', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="CCCD"><input inputMode="numeric" value={employee.identity.citizenIdentityNumber} onChange={(event) => update('identity', 'citizenIdentityNumber', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Ngày cấp"><input type="date" value={employee.identity.issuedDate} onChange={(event) => update('identity', 'issuedDate', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Nơi cấp"><input value={employee.identity.issuedPlace} onChange={(event) => update('identity', 'issuedPlace', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
        </HrFormSection>

        <HrFormSection title="Bảo hiểm">
          <HrField label="Số BHXH"><input value={employee.insurance.socialInsuranceNumber} onChange={(event) => update('insurance', 'socialInsuranceNumber', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Số BHYT"><input value={employee.insurance.healthInsuranceNumber} onChange={(event) => update('insurance', 'healthInsuranceNumber', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Hiệu lực từ"><input type="date" value={employee.insurance.validFrom} onChange={(event) => update('insurance', 'validFrom', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Hiệu lực đến"><input type="date" value={employee.insurance.validUntil} onChange={(event) => update('insurance', 'validUntil', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
        </HrFormSection>

        <HrFormSection title="Liên hệ">
          <HrField label="Điện thoại"><input type="tel" value={employee.contact.phone} onChange={(event) => update('contact', 'phone', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Email cá nhân"><input type="email" value={employee.contact.personalEmail} onChange={(event) => update('contact', 'personalEmail', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Email công việc"><input type="email" value={employee.contact.workEmail} onChange={(event) => update('contact', 'workEmail', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Địa chỉ thường trú" wide><textarea value={employee.contact.permanentAddress} onChange={(event) => update('contact', 'permanentAddress', event.target.value)} className={HR_TEXTAREA_CLASS} /></HrField>
          <HrField label="Địa chỉ hiện tại" wide><textarea value={employee.contact.currentAddress} onChange={(event) => update('contact', 'currentAddress', event.target.value)} className={HR_TEXTAREA_CLASS} /></HrField>
          <HrField label="Người liên hệ khẩn cấp"><input value={employee.contact.emergencyContactName} onChange={(event) => update('contact', 'emergencyContactName', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="SĐT khẩn cấp"><input type="tel" value={employee.contact.emergencyContactPhone} onChange={(event) => update('contact', 'emergencyContactPhone', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
          <HrField label="Quan hệ"><input value={employee.contact.emergencyContactRelation} onChange={(event) => update('contact', 'emergencyContactRelation', event.target.value)} className={HR_INPUT_CLASS} /></HrField>
        </HrFormSection>

        <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <ContractExportPlaceholderButton className="sm:mr-auto" />
          <Button type="button" variant="secondary" disabled={saving} onClick={() => navigate('/manager/hr/general-labor')}>Hủy</Button>
          <Button type="submit" disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu và tạo Tăng nhân sự'}</Button>
        </div>
      </form>
    </HrPageShell>
  );
}

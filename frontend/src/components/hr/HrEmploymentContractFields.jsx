import { CalendarClock, FileOutput, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { HR_INPUT_CLASS, HrField, HrFormSection } from './HrFormControls';
import {
  EMPLOYMENT_CONTRACT_TYPES,
  addYearsIso,
  updateContractForm,
} from '../../utils/hrOnboarding';

export function ContractExportButton({ className = '', size = 'md', loading = false, children, ...props }) {
  return (
    <Button type="button" size={size} variant="secondary" className={className} {...props}>
      <FileOutput className="h-4 w-4" />{children || (loading ? 'Đang xuất...' : 'Xuất hợp đồng')}
    </Button>
  );
}

export default function HrEmploymentContractFields({ value, onChange, disabled = false, compact = false }) {
  const update = (field, nextValue) => onChange(updateContractForm(value, field, nextValue));
  const content = (
    <>
      <fieldset className="sm:col-span-2" disabled={disabled}>
        <legend className="text-sm font-medium text-gray-700">Loại hợp đồng *</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${value.contractType === EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-100' : 'border-gray-200 bg-white hover:border-emerald-300'}`}>
            <input
              type="radio"
              name="employment-contract-type"
              value={EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS}
              checked={value.contractType === EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS}
              onChange={(event) => update('contractType', event.target.value)}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><CalendarClock className="h-4 w-4 text-emerald-700" />Hợp đồng 1 năm</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">Ngày kết thúc được tính đúng một năm sau ngày hiệu lực.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${value.contractType === EMPLOYMENT_CONTRACT_TYPES.INDEFINITE ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-100' : 'border-gray-200 bg-white hover:border-emerald-300'}`}>
            <input
              type="radio"
              name="employment-contract-type"
              value={EMPLOYMENT_CONTRACT_TYPES.INDEFINITE}
              checked={value.contractType === EMPLOYMENT_CONTRACT_TYPES.INDEFINITE}
              onChange={(event) => update('contractType', event.target.value)}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><InfinityIcon className="h-4 w-4 text-emerald-700" />Không xác định thời hạn</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">Không lưu ngày kết thúc hợp đồng.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <HrField label="Số hợp đồng *" htmlFor="employment-contract-number">
        <input
          id="employment-contract-number"
          required
          maxLength={100}
          disabled={disabled}
          value={value.contractNumber}
          onChange={(event) => update('contractNumber', event.target.value)}
          placeholder="Ví dụ: 012/HĐLĐ-PBHC/2026"
          className={HR_INPUT_CLASS}
        />
      </HrField>
      <HrField label="Ngày ký *" htmlFor="employment-contract-sign-date">
        <input id="employment-contract-sign-date" type="date" required disabled={disabled} value={value.signDate} onChange={(event) => update('signDate', event.target.value)} className={HR_INPUT_CLASS} />
      </HrField>
      <HrField label="Hiệu lực từ *" htmlFor="employment-contract-effective-from">
        <input id="employment-contract-effective-from" type="date" required disabled={disabled} value={value.effectiveFrom} onChange={(event) => update('effectiveFrom', event.target.value)} className={HR_INPUT_CLASS} />
      </HrField>
      <HrField
        label="Hiệu lực đến"
        htmlFor="employment-contract-effective-until"
        hint={value.contractType === EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS
          ? `Tự động tính: ${addYearsIso(value.effectiveFrom) || 'chọn ngày hiệu lực trước'}`
          : 'Không áp dụng cho hợp đồng không xác định thời hạn.'}
      >
        <input
          id="employment-contract-effective-until"
          type="date"
          readOnly
          disabled={disabled || value.contractType === EMPLOYMENT_CONTRACT_TYPES.INDEFINITE}
          value={value.effectiveUntil}
          className={`${HR_INPUT_CLASS} bg-gray-50 text-gray-600 disabled:bg-gray-100`}
        />
      </HrField>
    </>
  );

  if (compact) return <div className="grid gap-4 sm:grid-cols-2">{content}</div>;
  return (
    <HrFormSection title="Hợp đồng lao động" description="Thông tin này được dùng để lưu hồ sơ và sinh file Word hợp đồng chính thức.">
      {content}
    </HrFormSection>
  );
}

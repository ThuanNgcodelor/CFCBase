export const EMPLOYMENT_CONTRACT_TYPES = {
  FIXED_TERM_12_MONTHS: 'FIXED_TERM_12_MONTHS',
  INDEFINITE: 'INDEFINITE',
};

export const EMPLOYMENT_CONTRACT_LABELS = {
  [EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS]: 'Hợp đồng xác định thời hạn 12 tháng',
  [EMPLOYMENT_CONTRACT_TYPES.INDEFINITE]: 'Hợp đồng không xác định thời hạn',
};

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function newIdempotencyKey(prefix = 'hr-onboarding') {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseIsoDate(value) {
  const parts = String(value || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addYearsIso(value, years = 1) {
  const source = parseIsoDate(value);
  if (!source) return '';
  const targetYear = source.year + years;
  const lastDayOfMonth = new Date(Date.UTC(targetYear, source.month, 0)).getUTCDate();
  return isoDate(targetYear, source.month, Math.min(source.day, lastDayOfMonth));
}

export function addDaysIso(value, days = 1) {
  const source = parseIsoDate(value);
  if (!source) return '';
  const date = new Date(Date.UTC(source.year, source.month - 1, source.day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createContractForm(effectiveFrom = '') {
  const startDate = effectiveFrom || todayInput();
  return {
    contractType: EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS,
    contractNumber: '',
    signDate: todayInput(),
    effectiveFrom: startDate,
    effectiveUntil: addYearsIso(startDate),
  };
}

export function updateContractForm(current, field, value) {
  const next = { ...current, [field]: value };
  if (field === 'contractType') {
    next.effectiveUntil = value === EMPLOYMENT_CONTRACT_TYPES.INDEFINITE
      ? ''
      : addYearsIso(next.effectiveFrom);
  }
  if (field === 'effectiveFrom') {
    next.effectiveUntil = next.contractType === EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS
      ? addYearsIso(value)
      : '';
  }
  return next;
}

export function validateContractForm(contract) {
  if (!Object.values(EMPLOYMENT_CONTRACT_TYPES).includes(contract?.contractType)) {
    return 'Vui lòng chọn loại hợp đồng lao động.';
  }
  if (!contract.contractNumber?.trim()) return 'Vui lòng nhập số hợp đồng.';
  if (!contract.signDate) return 'Vui lòng chọn ngày ký hợp đồng.';
  if (!contract.effectiveFrom) return 'Vui lòng chọn ngày hợp đồng có hiệu lực.';

  if (contract.contractType === EMPLOYMENT_CONTRACT_TYPES.FIXED_TERM_12_MONTHS) {
    const expectedEndDate = addYearsIso(contract.effectiveFrom);
    if (contract.effectiveUntil !== expectedEndDate) {
      return `Hợp đồng 12 tháng phải kết thúc vào ${expectedEndDate}.`;
    }
  } else if (contract.effectiveUntil) {
    return 'Hợp đồng không xác định thời hạn không có ngày kết thúc.';
  }

  return '';
}

export function contractPayload(contract) {
  return {
    contractType: contract.contractType,
    contractNumber: contract.contractNumber.trim(),
    signDate: contract.signDate,
    effectiveFrom: contract.effectiveFrom,
    effectiveUntil: contract.contractType === EMPLOYMENT_CONTRACT_TYPES.INDEFINITE
      ? null
      : contract.effectiveUntil,
  };
}

export function contractTypeLabel(contractType) {
  return EMPLOYMENT_CONTRACT_LABELS[contractType] || contractType || 'Chưa chọn';
}

export const initialsOf = (fullName = '') => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'HR';
  const last = words.at(-1)?.[0] || '';
  const previous = words.length > 1 ? words.at(-2)?.[0] || '' : '';
  return `${previous}${last}`.toLocaleUpperCase('vi');
};

export const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${amount.toLocaleString('vi-VN')} đ`;
};

export const formatDateDisplay = (value) => {
  if (!value) return '—';
  const stringValue = String(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(stringValue)) return stringValue;
  const match = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return stringValue;
  return new Intl.DateTimeFormat('vi-VN').format(parsed);
};

export const toDateInput = (value) => {
  if (!value) return '';
  const stringValue = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;
  const match = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return stringValue.slice(0, 10);
};

export const catalogNames = (items = []) =>
  items.map((item) => item?.name || item).filter(Boolean);

export const statusLabel = (status) => ({
  ACTIVE: 'Đang làm việc',
  DRAFT: 'Bản nháp',
  INACTIVE: 'Ngừng hoạt động',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  CONTRACT_CREATED: 'Đã tạo HĐ',
  IN_PROBATION: 'Đang thử việc',
  PASSED: 'Đạt thử việc',
  FAILED: 'Không đạt',
  CONVERTED: 'Đã chuyển hồ sơ',
  LIVE: 'Số liệu sống',
  BASELINE: 'Baseline'
}[status] || status || '—');

export const movementTypeLabel = (type) =>
  type === 'DECREASE' ? 'Giảm' : 'Tăng';

export const normalizeEmployee = (employee, index = 0) => ({
  id: employee.id || employee.code || employee.employeeCode || `employee-${index}`,
  code: employee.code || employee.employeeCode || '',
  fullName: employee.fullName || employee.name || '',
  department: employee.department?.name || employee.department || '',
  position: employee.position?.name || employee.position || '',
  workingCondition: employee.workingCondition?.name || employee.workingCondition || '',
  joinDate: employee.joinDate || employee.hireDate || '',
  status: employee.status || '',
  ...employee
});

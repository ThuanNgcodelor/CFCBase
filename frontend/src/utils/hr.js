const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  DRAFT: 'Bản nháp',
  OPEN: 'Đang mở',
  CLOSED: 'Đã chốt',
  EXPORTED: 'Đã xuất',
  UPLOADED: 'Đã tải lên',
  PARSED: 'Đã đọc file',
  VALIDATED: 'Đã kiểm tra',
  CONFIRMED: 'Đã xác nhận',
  FAILED: 'Thất bại',
  ROLLED_BACK: 'Đã hoàn tác',
  CANCELLED: 'Đã hủy',
  PENDING: 'Chờ xử lý',
  VALID: 'Hợp lệ',
  WARNING: 'Cần lưu ý',
  INVALID: 'Không hợp lệ',
  IMPORTED: 'Đã nhập',
  SKIPPED: 'Đã bỏ qua',
  VERIFIED: 'Đã xác minh',
  UNVERIFIED: 'Chưa xác minh',
  NEEDS_REVIEW: 'Cần kiểm tra',
  UNKNOWN: 'Chưa xác định',
  CONTRACT_CREATED: 'Đã tạo HĐ thử việc',
  IN_PROBATION: 'Đang thử việc',
  PASSED: 'Đạt thử việc',
  CONVERTED: 'Đã chuyển hồ sơ',
  GENERATED: 'Đã tạo',
  VOIDED: 'Đã hủy',
};

const MOVEMENT_LABELS = {
  INITIAL_LOAD: 'Dữ liệu ban đầu',
  INCREASE: 'Tăng nhân sự',
  DECREASE: 'Giảm nhân sự',
  TRANSFER: 'Chuyển đơn vị',
  POSITION_CHANGE: 'Đổi chức vụ',
  WORKING_CONDITION_CHANGE: 'Đổi điều kiện lao động',
  ADJUSTMENT: 'Điều chỉnh',
  REHIRE: 'Tiếp nhận lại',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Chưa xác định';
}

export function employmentStatusLabel(status) {
  const labels = {
    ACTIVE: 'Đang làm việc',
    INACTIVE: 'Đã nghỉ việc',
    DRAFT: 'Hồ sơ nháp',
  };
  return labels[status] || statusLabel(status);
}

export function movementLabel(type) {
  return MOVEMENT_LABELS[type] || type || 'Chưa xác định';
}

export function statusTone(status) {
  if (['ACTIVE', 'CONFIRMED', 'VALID', 'IMPORTED', 'VERIFIED', 'PASSED', 'CONVERTED', 'GENERATED'].includes(status)) return 'green';
  if (['WARNING', 'NEEDS_REVIEW', 'OPEN', 'PARSED', 'UPLOADED', 'PENDING', 'CONTRACT_CREATED', 'IN_PROBATION'].includes(status)) return 'amber';
  if (['FAILED', 'INVALID', 'CANCELLED'].includes(status)) return 'red';
  if (['CLOSED', 'EXPORTED', 'VALIDATED'].includes(status)) return 'blue';
  return 'gray';
}

export function formatHrDate(value, options = {}) {
  if (!value) return '—';
  const source = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(source.getTime())) return String(value);
  return source.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatHrDateTime(value) {
  if (!value) return '—';
  const source = new Date(value);
  if (Number.isNaN(source.getTime())) return String(value);
  return source.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPeriod(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length >= 2 ? `T${Number(parts[1])}-${String(parts[0]).slice(-2)}` : String(value);
}

export function apiErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
}

export function nonEmpty(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

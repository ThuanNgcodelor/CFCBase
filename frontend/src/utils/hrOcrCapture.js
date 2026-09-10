const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const PHONE_PATH = new RegExp(`^/manager/hr/general-labor/ocr-capture/${UUID}$`);
export const captureKindLabel = { FRONT: 'CCCD mặt trước', BACK: 'CCCD mặt sau', OTHER: 'Giấy tờ khác' };
export const captureStatusLabel = { OPEN: 'Sẵn sàng nhận ảnh', SCANNING: 'Đang đọc thông tin…', READY: 'Đã có kết quả OCR', FAILED: 'Cần đọc lại', CANCELLED: 'Đã hủy phiên', COMPLETED: 'Đã kết thúc phiên' };
export const isCaptureId = (id) => new RegExp(`^${UUID}$`).test(id || '');
export const capturePhonePath = (id) => `/manager/hr/general-labor/ocr-capture/${id}`;
// This feature needs a login return only to its own phone page, never an arbitrary URL.
export function ocrLoginTarget(search) {
  const path = new URLSearchParams(search).get('ocrReturn');
  return PHONE_PATH.test(path || '') ? path : null;
}
export function ocrLoginPath(pathname) {
  return PHONE_PATH.test(pathname) ? `/login?ocrReturn=${encodeURIComponent(pathname)}` : '/login';
}

export const OCR_FIELDS = [
  ['personal', 'fullName', 'Họ và tên'], ['personal', 'gender', 'Giới tính'],
  ['personal', 'dateOfBirth', 'Ngày sinh'], ['personal', 'ethnicity', 'Dân tộc'],
  ['personal', 'religion', 'Tôn giáo'], ['personal', 'birthPlaceOriginal', 'Quê quán'],
  ['personal', 'birthPlaceCurrent', 'Nơi sinh'], ['personal', 'educationLevel', 'Học vấn'],
  ['personal', 'major', 'Chuyên ngành'], ['identity', 'legacyIdentityNumber', 'Số CMND'],
  ['identity', 'citizenIdentityNumber', 'Số CCCD'], ['identity', 'issuedDate', 'Ngày cấp'],
  ['identity', 'issuedPlace', 'Nơi cấp'], ['insurance', 'socialInsuranceNumber', 'Số BHXH'],
  ['insurance', 'healthInsuranceNumber', 'Số BHYT'], ['contact', 'phone', 'Điện thoại'],
  ['contact', 'personalEmail', 'Email'], ['contact', 'permanentAddress', 'Thường trú'],
  ['contact', 'currentAddress', 'Chỗ ở hiện tại'], ['contact', 'emergencyContactName', 'Liên hệ khẩn cấp'],
  ['contact', 'emergencyContactPhone', 'SĐT khẩn cấp'], ['contact', 'emergencyContactRelation', 'Quan hệ'],
];
export function ocrCandidates(employee, result) {
  return OCR_FIELDS.flatMap(([section, field, label]) => {
    const value = typeof result?.[field] === 'string' ? result[field].trim() : '';
    if (!value || value === 'UNKNOWN') return [];
    if (field === 'gender' && !['MALE', 'FEMALE', 'OTHER'].includes(value)) return [];
    if (['dateOfBirth', 'issuedDate'].includes(field)
      && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return [];
    const previous = employee[section]?.[field] ?? '';
    if (previous === value) return [];
    return [{ section, field, label, value, previous, key: `${section}.${field}`, conflict: previous !== '' && previous !== 'UNKNOWN' }];
  });
}
export function applyOcrSelection(employee, candidates, selected) {
  const next = { ...employee };
  for (const item of candidates) {
    // Never overwrite a field edited after the review was opened.
    if (selected.includes(item.key) && (employee[item.section]?.[item.field] ?? '') === item.previous) {
      next[item.section] = { ...next[item.section], [item.field]: item.value };
    }
  }
  return next;
}

export async function prepareCaptureImage(file) {
  if (!file?.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Chọn ảnh tối đa 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Không mở được ảnh. Hãy chụp lại hoặc chọn ảnh JPEG/PNG.'));
      img.src = url;
    });
    const ratio = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Ảnh quá lớn. Hãy chụp gần giấy tờ hơn.');
    return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}

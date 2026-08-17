export const HR_DOCUMENT_CATEGORIES = [
  { value: 'CITIZEN_ID', label: 'CCCD / CMND', tone: 'blue' },
  { value: 'CURRICULUM_VITAE', label: 'Sơ yếu lý lịch', tone: 'green' },
  { value: 'DEGREE_CERTIFICATE', label: 'Bằng cấp & Chứng chỉ', tone: 'purple' },
  { value: 'HEALTH_CERTIFICATE', label: 'Giấy khám sức khỏe', tone: 'red' },
  { value: 'LABOR_CONTRACT', label: 'Hợp đồng lao động scan', tone: 'amber' },
  { value: 'DECISION', label: 'Quyết định / Khen thưởng', tone: 'indigo' },
  { value: 'OTHER', label: 'Tài liệu khác', tone: 'gray' },
];

export const HR_DOCUMENT_CATEGORY_MAP = Object.fromEntries(
  HR_DOCUMENT_CATEGORIES.map((item) => [item.value, item]),
);

export function documentCategoryLabel(category) {
  return HR_DOCUMENT_CATEGORY_MAP[category]?.label || category || 'Chưa phân loại';
}

export function documentCategoryTone(category) {
  return HR_DOCUMENT_CATEGORY_MAP[category]?.tone || 'gray';
}

export function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return '0 B';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

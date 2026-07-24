import { useEffect, useState } from 'react';
import SEOHead from '../../components/SEOHead';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrReadOnlyNotice } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime, nonEmpty } from '../../utils/hr';

const FIELD_LABELS = {
  personal: 'Thông tin chung',
  employment: 'Công việc',
  identity: 'Định danh',
  insurance: 'Bảo hiểm',
  contact: 'Liên hệ',
  code: 'Mã',
  name: 'Tên',
  description: 'Mô tả',
  sortOrder: 'Thứ tự hiển thị',
  parentId: 'Phòng ban cấp trên',
  status: 'Trạng thái',
  movementType: 'Loại biến động',
  effectiveDate: 'Ngày hiệu lực',
  reason: 'Lý do',
  decisionNumber: 'Số quyết định',
  decisionDate: 'Ngày quyết định',
  confirmedAt: 'Thời điểm xác nhận',
  employeeStatus: 'Trạng thái nhân sự',
  cancelledAt: 'Thời điểm hủy',
  deleted: 'Xóa bản nháp',
  periodStart: 'Kỳ tháng',
  sourceRosterId: 'Kỳ nguồn',
  openedAt: 'Thời điểm mở',
  itemCount: 'Số nhân sự',
  closedAt: 'Thời điểm chốt',
  rosterChecksum: 'Mã kiểm tra snapshot',
  employmentStatus: 'Trạng thái làm việc',
  terminationDate: 'Ngày nghỉ việc',
  profile: 'Thông tin hồ sơ',
};

const ACTION_LABELS = {
  HR_EMPLOYEE_CREATED: 'Tạo hồ sơ nhân sự',
  HR_EMPLOYEE_UPDATED: 'Cập nhật hồ sơ nhân sự',
  HR_CATALOG_CREATED: 'Tạo danh mục',
  HR_CATALOG_UPDATED: 'Cập nhật danh mục',
  BASELINE_IMPORT_PARSED: 'Đọc file dữ liệu ban đầu',
  BASELINE_IMPORT_VALIDATED: 'Kiểm tra dữ liệu ban đầu',
  BASELINE_IMPORT_CONFIRMED: 'Xác nhận nhập dữ liệu ban đầu',
  BASELINE_IMPORT_ROLLED_BACK: 'Hoàn tác dữ liệu ban đầu',
  IMPORT_PAYLOAD_PURGED: 'Xóa nội dung xem trước hết hạn',
  HR_MOVEMENT_CREATED: 'Tạo biến động nhân sự',
  HR_MOVEMENT_CONFIRMED: 'Xác nhận biến động nhân sự',
  HR_MOVEMENT_CANCELLED: 'Hủy biến động nhân sự',
  HR_MOVEMENT_DRAFT_DELETED: 'Xóa biến động nháp',
  HR_EMPLOYEE_DRAFT_DELETED: 'Xóa hồ sơ nhân sự nháp',
  HR_ROSTER_CREATED: 'Tạo danh sách tháng',
  HR_ROSTER_OPENED: 'Mở danh sách tháng',
  HR_ROSTER_CLOSED: 'Chốt danh sách tháng',
  HR_ROSTER_REOPENED: 'Mở lại danh sách tháng',
  HR_ROSTER_DRAFT_DELETED: 'Xóa danh sách tháng nháp',
  WORKFORCE_SNAPSHOT_INCREASED: 'Tăng nhân sự từ file 339',
  WORKFORCE_SNAPSHOT_DECREASED: 'Giảm nhân sự từ file 339',
  WORKFORCE_SNAPSHOT_PROFILE_UPDATED: 'Đồng bộ hồ sơ từ file 339',
  WORKFORCE_SNAPSHOT_ROSTER_CREATED: 'Tạo roster HR từ file nhân sự',
  WORKFORCE_SNAPSHOT_IMPORTED: 'Áp dụng file cập nhật 339',
};

const ENTITY_LABELS = {
  HR_EMPLOYEE: 'Hồ sơ nhân sự',
  HR_DEPARTMENT: 'Phòng ban',
  HR_POSITION: 'Chức vụ',
  HR_WORKING_CONDITION: 'Điều kiện lao động',
  HR_IMPORT_BATCH: 'Lần nhập dữ liệu',
  HR_EMPLOYEE_MOVEMENT: 'Biến động nhân sự',
  HR_MONTHLY_ROSTER: 'Danh sách tháng',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action || 'Chưa xác định';
}

function entityLabel(entityType) {
  return ENTITY_LABELS[entityType] || entityType || 'Chưa xác định';
}

function changedFieldsLabel(value) {
  let fields = value;
  if (typeof fields === 'string') {
    const normalized = fields.trim();
    if (!normalized) return 'Không ghi nhận trường thay đổi';
    try {
      fields = JSON.parse(normalized);
    } catch {
      fields = normalized.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return 'Chi tiết thay đổi được bảo vệ';
  }

  return fields
    .filter((field) => typeof field === 'string' && field.trim())
    .map((field) => FIELD_LABELS[field] || field)
    .join(', ') || 'Chi tiết thay đổi được bảo vệ';
}

export default function HrAudit() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getAuditEvents({ page, size: 20 }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải nhật ký HR.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadKey]);

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Nhật ký nhân sự" url="https://cfcbooking.io.vn/manager/hr/audit" />
      <HrPageHeader title="Nhật ký thay đổi" description="Theo dõi người thao tác, hành động, đối tượng và thời gian trong phân hệ nhân sự." />
      <div className="mb-4"><HrReadOnlyNotice>Nhật ký chỉ được ghi thêm và không thể sửa. Nội dung nhạy cảm không được hiển thị tại đây.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block"><table className="w-full min-w-[1080px] divide-y divide-gray-200"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Người thao tác</th><th className="px-5 py-4">Hành động</th><th className="px-5 py-4">Đối tượng</th><th className="px-5 py-4">Trường thay đổi</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((event) => <tr key={event.id} className="align-top hover:bg-gray-50/70"><td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDateTime(event.occurredAt)}</td><td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{nonEmpty(event.actorDisplayName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(event.actorSubject)}</p></td><td className="px-5 py-4 text-sm font-medium text-emerald-700">{actionLabel(event.action)}</td><td className="px-5 py-4"><p className="text-sm text-gray-700">{entityLabel(event.entityType)}</p><p className="mt-1 max-w-[180px] truncate text-xs text-gray-500">{nonEmpty(event.entityId)}</p></td><td className="max-w-sm px-5 py-4 text-sm text-gray-500">{changedFieldsLabel(event.changedFields)}</td></tr>)}{!loading && result.content.length === 0 && <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có nhật ký phù hợp" /></td></tr>}</tbody></table></div>
      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((event) => (
          <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">{actionLabel(event.action)}</p><p className="mt-1 text-xs text-gray-500">{formatHrDateTime(event.occurredAt)}</p></div><span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">{entityLabel(event.entityType)}</span></div>
            <p className="mt-3 text-sm font-medium text-gray-900">{nonEmpty(event.actorDisplayName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(event.actorSubject)}</p>
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <p>Đối tượng: {nonEmpty(event.entityId)}</p>
              <p>Trường thay đổi: {changedFieldsLabel(event.changedFields)}</p>
            </div>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Chưa có nhật ký phù hợp" />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </HrPageShell>
  );
}

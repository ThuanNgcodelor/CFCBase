import { useState } from 'react';
import { HrEmpty, HrError, HrLoading, HrPagination, HrStatusBadge } from './HrUi';
import { useEmployeeProfilePage } from './useEmployeeProfilePage';
import { formatHrDate, formatHrDateTime, movementLabel } from '../../utils/hr';

const STATUS = { DRAFT: 'Bản nháp', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy' };
const ACTIONS = {
  HR_EMPLOYEE_CREATED: 'Tạo hồ sơ', HR_EMPLOYEE_UPDATED: 'Cập nhật hồ sơ',
  WORKFORCE_SNAPSHOT_PROFILE_UPDATED: 'Cập nhật hồ sơ từ file nhân sự',
  HR_GENERAL_LABOR_ONBOARDED: 'Tiếp nhận lao động phổ thông',
};
const FIELDS = { personal: 'Thông tin chung', employment: 'Công việc', identity: 'Định danh',
  insurance: 'Bảo hiểm', contact: 'Liên hệ', profile: 'Hồ sơ', employmentStatus: 'Trạng thái',
  status: 'Trạng thái', workforceGroup: 'Nhóm nhân sự', onboardingSource: 'Nguồn tiếp nhận' };
function fieldsLabel(value) {
  try { const fields = JSON.parse(value || '[]'); return Array.isArray(fields) ? fields.map((f) => FIELDS[f] || f).join(', ') : ''; }
  catch { return ''; }
}

function HistoryList({ employeeId, section }) {
  const { data, loading, error, setPage, reload } = useEmployeeProfilePage(employeeId, section);
  if (loading) return <HrLoading />;
  if (error) return <HrError message={error} onRetry={reload} />;
  return <>
    {data.content.length === 0 ? <HrEmpty title="Chưa có lịch sử" description="Chưa ghi nhận sự kiện thuộc loại này cho nhân sự." /> : (
      <ol className="divide-y divide-gray-100">
        {data.content.map((item) => <li key={item.id} className="space-y-2 py-4">
          {section === 'movements' ? <>
            <div className="flex flex-wrap items-center gap-2"><strong>{movementLabel(item.movementType)}</strong>
              <HrStatusBadge status={item.status} label={STATUS[item.status] || item.status} />
              {item.supersededByAdjustment && <span className="text-sm text-amber-700">Đã được điều chỉnh</span>}
            </div>
            <p className="text-sm">Hiệu lực: {formatHrDate(item.effectiveDate)} · {item.fromDepartment || 'Chưa có phòng ban'} → {item.toDepartment || 'Không có phòng ban'}</p>
            <p className="text-sm text-gray-600">{item.reason || 'Không có ghi chú'}{item.decisionNumber ? ` · Quyết định: ${item.decisionNumber}` : ''}</p>
            {item.correctionOfMovementId && <p className="text-sm text-amber-700">Điều chỉnh biến động ngày {formatHrDate(item.correctionOfEffectiveDate)}</p>}
            <p className="text-xs text-gray-500">Tạo: {formatHrDateTime(item.createdAt)} · {item.createdByActor || 'Hệ thống'}</p>
            {item.confirmedAt && <p className="text-xs text-gray-500">Xác nhận: {formatHrDateTime(item.confirmedAt)} · {item.confirmedByActor}</p>}
            {item.cancelledAt && <p className="text-xs text-gray-500">Hủy: {formatHrDateTime(item.cancelledAt)} · {item.cancelledByActor}</p>}
          </> : <>
            <strong>{ACTIONS[item.action] || 'Thay đổi hồ sơ nhân sự'}</strong>
            <p className="text-sm text-gray-600">{fieldsLabel(item.changedFields) || 'Không có chi tiết trường thay đổi'}</p>
            <p className="text-xs text-gray-500">{formatHrDateTime(item.occurredAt)} · {item.actorDisplayName || 'Hệ thống'}</p>
          </>}
        </li>)}
      </ol>
    )}
    <HrPagination page={data.number} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
  </>;
}

export function HrEmployeeHistoryTab({ employeeId }) {
  const [section, setSection] = useState('movements');
  return <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <h2 className="font-semibold">Lịch sử nhân sự</h2>
    <p className="mt-1 text-sm text-gray-500">Biến động sắp theo ngày hiệu lực; nhật ký hồ sơ ghi người sửa, thời điểm và nhóm thông tin thay đổi. Các bản Word nằm trong tab Hợp đồng.</p>
    <div className="my-4 flex flex-wrap gap-2">
      {[['movements', 'Biến động tăng / giảm'], ['profile-audit', 'Nhật ký sửa hồ sơ']].map(([key, label]) =>
        <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)} className={`rounded-lg border px-4 py-2 text-sm ${section === key ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200'}`}>{label}</button>)}
    </div>
    <HistoryList key={`${employeeId}/${section}`} employeeId={employeeId} section={section} />
  </section>;
}

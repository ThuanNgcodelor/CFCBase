import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDate, movementLabel, nonEmpty } from '../../utils/hr';

function MovementRoute({ item }) {
  const from = item.fromDepartmentName || item.fromDepartment?.name || item.fromDepartment
    || item.fromPositionName || item.fromPosition?.name || item.fromPosition;
  const to = item.toDepartmentName || item.toDepartment?.name || item.toDepartment
    || item.toPositionName || item.toPosition?.name || item.toPosition;
  return <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500"><span>{nonEmpty(from)}</span><ArrowRight className="h-3.5 w-3.5" /><span className="font-medium text-gray-700">{nonEmpty(to)}</span></div>;
}

export default function HrMovements() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getMovements({ page, size: 20 }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải lịch sử tăng/giảm.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadKey]);

  return (
    <div className="w-full">
      <SEOHead title="CFC Base | Tăng giảm nhân sự" url="https://cfcbooking.io.vn/manager/hr/movements" />
      <HrPageHeader title="Tăng / Giảm nhân sự" description="Tra cứu các biến động đã được ghi nhận, bao gồm dữ liệu ban đầu, tăng, giảm và điều chuyển." />
      <div className="mb-4"><HrReadOnlyNotice>Phase 3 chỉ cung cấp tra cứu an toàn. Flow tạo và xác nhận Tăng/Giảm theo tháng sẽ được triển khai ở Phase 5; trang này không tạo thao tác giả.</HrReadOnlyNotice></div>

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-5 py-4">Nhân sự</th><th className="px-5 py-4">Loại</th><th className="px-5 py-4">Hiệu lực</th><th className="px-5 py-4">Thay đổi</th><th className="px-5 py-4">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((item) => <tr key={item.id} className="align-top hover:bg-gray-50/70"><td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{item.employeeName || item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode}</p></td><td className="px-5 py-4 text-sm text-gray-700">{movementLabel(item.movementType || item.type)}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDate(item.effectiveDate)}</td><td className="px-5 py-4"><MovementRoute item={item} />{item.reason && <p className="mt-2 max-w-sm text-xs text-gray-500">{item.reason}</p>}</td><td className="px-5 py-4"><HrStatusBadge status={item.status} /></td></tr>)}{!loading && result.content.length === 0 && <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có biến động phù hợp" /></td></tr>}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((item) => <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.employeeName || item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode} · {formatHrDate(item.effectiveDate)}</p></div><HrStatusBadge status={item.status} /></div><p className="mt-3 text-sm font-medium text-emerald-700">{movementLabel(item.movementType || item.type)}</p><div className="mt-2"><MovementRoute item={item} /></div>{item.reason && <p className="mt-2 text-xs text-gray-500">{item.reason}</p>}</div>)}{!loading && result.content.length === 0 && <HrEmpty title="Chưa có biến động phù hợp" />}</div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </div>
  );
}

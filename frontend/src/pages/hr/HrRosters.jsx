import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, TableProperties } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime, formatPeriod, nonEmpty } from '../../utils/hr';

export default function HrRosters() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getRosters({ page, size: 20 }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh sách tháng.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadKey]);

  return (
    <div className="w-full max-w-6xl">
      <SEOHead title="CFC Base | Danh sách nhân sự theo tháng" url="https://cfcbooking.io.vn/manager/hr/rosters" />
      <HrPageHeader title="Danh sách nhân sự theo tháng" description="Mỗi kỳ là một snapshot độc lập, dùng để đối chiếu headcount và ngày phép tại thời điểm chốt." />
      <div className="mb-4"><HrReadOnlyNotice>Phase 3 cho phép tra cứu snapshot hiện có. Chức năng mở, kế thừa, chốt lại kỳ và xuất đúng template Excel thuộc Phase 5–6.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? <div className="col-span-full rounded-xl border bg-white py-12 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((roster) => <button key={roster.id} type="button" onClick={() => navigate(`/manager/hr/rosters/${roster.id}`, { state: { roster } })} className="group rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md"><div className="flex items-start justify-between"><div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><TableProperties className="h-5 w-5" /></div><HrStatusBadge status={roster.status} /></div><p className="mt-4 text-xl font-semibold text-gray-900">{formatPeriod(roster.periodStart)}</p><p className="mt-1 text-sm text-gray-500">{nonEmpty(roster.itemCount)} nhân sự</p><div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500"><span>{formatHrDateTime(roster.closedAt || roster.openedAt || roster.createdAt)}</span><span className="flex items-center gap-1 font-medium text-emerald-700">Xem danh sách <Eye className="h-3.5 w-3.5" /></span></div></button>)}
        {!loading && result.content.length === 0 && <div className="col-span-full"><HrEmpty title="Chưa có danh sách tháng" description="Snapshot T6-26 sẽ xuất hiện sau khi baseline được xác nhận." /></div>}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </div>
  );
}

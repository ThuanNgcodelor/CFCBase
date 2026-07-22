import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDate, formatPeriod, nonEmpty } from '../../utils/hr';

export default function HrRosterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [roster, setRoster] = useState(() => location.state?.roster || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getRosterItems(id, { page, size: 20, sort: 'displayOrder,asc' }, { signal: controller.signal })
      .then((data) => {
        if (data?.roster) setRoster(data.roster);
        setResult(normalizePage(data?.items || data));
      })
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải snapshot nhân sự.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, page, reloadKey]);

  return (
    <div className="w-full">
      <SEOHead title="CFC Base | Chi tiết danh sách tháng" />
      <HrPageHeader title={roster?.periodStart ? `Danh sách ${formatPeriod(roster.periodStart)}` : 'Chi tiết danh sách tháng'} description={`${result.totalElements} nhân sự trong snapshot`} actions={<Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách tháng</Button>} />
      {roster?.status && <div className="mb-4"><HrStatusBadge status={roster.status} /></div>}
      <div className="mb-4"><HrReadOnlyNotice>Snapshot không chứa CCCD, BHXH, BHYT, địa chỉ, điện thoại hoặc lương. Dữ liệu của kỳ đã chốt chỉ được tra cứu.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-3">STT</th><th className="px-4 py-3">Nhân sự</th><th className="px-4 py-3">Phòng ban</th><th className="px-4 py-3">Chức vụ</th><th className="px-4 py-3">Ngày vào làm</th><th className="px-4 py-3">Ngày phép</th><th className="px-4 py-3">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((item) => <tr key={item.id} className="hover:bg-gray-50/70"><td className="px-4 py-4 text-sm text-gray-500">{item.displayOrder}</td><td className="px-4 py-4"><p className="text-sm font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode}</p></td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.departmentName)}</td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.positionName)}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{formatHrDate(item.hireDate)}</td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.leaveDays)}</td><td className="px-4 py-4"><HrStatusBadge status={item.employmentStatus} /></td></tr>)}
            {!loading && result.content.length === 0 && <tr><td colSpan="7" className="p-5"><HrEmpty title="Snapshot chưa có nhân sự" /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">#{item.displayOrder} · {item.employeeCode}</p></div><HrStatusBadge status={item.employmentStatus} /></div>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs"><div><dt className="text-gray-400">Phòng ban</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.departmentName)}</dd></div><div><dt className="text-gray-400">Chức vụ</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.positionName)}</dd></div><div><dt className="text-gray-400">Ngày vào làm</dt><dd className="mt-1 font-medium text-gray-700">{formatHrDate(item.hireDate)}</dd></div><div><dt className="text-gray-400">Ngày phép</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.leaveDays)}</dd></div></dl>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Snapshot chưa có nhân sự" />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </div>
  );
}

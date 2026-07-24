import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarPlus, Download, Eye, TableProperties } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
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
  const [creating, setCreating] = useState(false);
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
  const [exporting, setExporting] = useState('');

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

  const latestRoster = page === 0 ? result.content[0] : null;

  const nextPeriodStart = (periodStart) => {
    if (!periodStart) return null;
    const [year, month] = String(periodStart).slice(0, 10).split('-').map(Number);
    if (!year || !month) return null;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  };

  const createNextRoster = async () => {
    if (!latestRoster) {
      toast.error('Cần có baseline đã chốt trước khi tạo tháng kế tiếp.');
      return;
    }
    if (!['CLOSED', 'EXPORTED'].includes(latestRoster.status)) {
      navigate(`/manager/hr/rosters/${latestRoster.id}`, { state: { roster: latestRoster } });
      return;
    }
    const periodStart = nextPeriodStart(latestRoster.periodStart);
    if (!periodStart) {
      toast.error('Không thể xác định tháng kế tiếp.');
      return;
    }
    if (!window.confirm(`Tạo danh sách ${formatPeriod(periodStart)} kế thừa từ ${formatPeriod(latestRoster.periodStart)}?`)) return;

    setCreating(true);
    try {
      const created = await hrActivityApi.createRoster(periodStart);
      toast.success(`Đã tạo ${formatPeriod(created.periodStart)} ở trạng thái bản nháp.`);
      navigate(`/manager/hr/rosters/${created.id}`, { state: { roster: created } });
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tạo danh sách tháng kế tiếp.'));
    } finally {
      setCreating(false);
    }
  };

  const parsePeriod = (periodStart) => {
    const [year, month] = String(periodStart || '').slice(0, 10).split('-').map(Number);
    return { year, month };
  };

  const exportYearFile = async () => {
    if (!exportYear || exportYear < 2000 || exportYear > 2100) {
      toast.error('Năm export không hợp lệ.');
      return;
    }
    setExporting('year');
    try {
      await hrActivityApi.exportYear({ year: exportYear });
      toast.success(`Đã tải file nhân sự năm ${exportYear}.`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể export file năm.'));
    } finally {
      setExporting('');
    }
  };

  const exportMonthFile = async (roster, event) => {
    event.stopPropagation();
    const { year, month } = parsePeriod(roster.periodStart);
    if (!year || !month) {
      toast.error('Không thể xác định tháng export.');
      return;
    }
    setExporting(roster.id);
    try {
      await hrActivityApi.exportMonth({ year, month });
      toast.success(`Đã tải file ${formatPeriod(roster.periodStart)}.`);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể export file tháng.'));
    } finally {
      setExporting('');
    }
  };

  const openRosterDetail = (roster) => {
    navigate(`/manager/hr/rosters/${roster.id}`, { state: { roster } });
  };

  const openRosterDetailByKeyboard = (roster, event) => {
    if (event.currentTarget !== event.target) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openRosterDetail(roster);
    }
  };

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Danh sách nhân sự theo tháng" url="https://cfcbooking.io.vn/manager/hr/rosters" />
      <HrPageHeader
        title="Danh sách nhân sự theo tháng"
        description="Mỗi kỳ là một dữ liệu độc lập. Kỳ mới luôn kế thừa từ kỳ gần nhất đã chốt và áp dụng các biến động đã xác nhận."
        actions={(
          <>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
              <input
                type="number"
                min="2000"
                max="2100"
                value={exportYear}
                onChange={(event) => setExportYear(Number(event.target.value))}
                className="h-9 w-24 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                aria-label="Năm export"
              />
              <Button type="button" size="sm" variant="secondary" disabled={exporting === 'year'} onClick={exportYearFile}>
                <Download className="mr-1.5 h-4 w-4" />Export năm
              </Button>
            </div>
            {page === 0 && latestRoster && (
              <Button type="button" disabled={creating} onClick={createNextRoster}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                {['CLOSED', 'EXPORTED'].includes(latestRoster.status)
                  ? `Tạo ${formatPeriod(nextPeriodStart(latestRoster.periodStart))}`
                  : `Tiếp tục ${formatPeriod(latestRoster.periodStart)}`}
              </Button>
            )}
          </>
        )}
      />
      <div className="mb-4"><HrReadOnlyNotice>Hãy xác nhận đầy đủ Tăng/Giảm trước khi mở và chốt tháng kế tiếp.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {loading ? <div className="col-span-full rounded-xl border bg-white py-12 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((roster) => <div key={roster.id} role="button" tabIndex={0} onClick={() => openRosterDetail(roster)} onKeyDown={(event) => openRosterDetailByKeyboard(roster, event)} className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm outline-none transition hover:border-emerald-200 hover:shadow-md focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"><div className="flex items-start justify-between"><div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><TableProperties className="h-5 w-5" /></div><div className="flex flex-wrap justify-end gap-1.5">{roster.baseline && <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Baseline</span>}<HrStatusBadge status={roster.status} /></div></div><p className="mt-4 text-xl font-semibold text-gray-900">{formatPeriod(roster.periodStart)}</p><p className="mt-1 text-sm text-gray-500">{nonEmpty(roster.itemCount)} nhân sự</p><div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500"><span>{formatHrDateTime(roster.closedAt || roster.openedAt || roster.createdAt)}</span><span className="flex items-center gap-1 font-medium text-emerald-700">Xem danh sách <Eye className="h-3.5 w-3.5" /></span></div><div className="mt-3"><Button type="button" size="sm" variant="secondary" disabled={exporting === roster.id} onClick={(event) => exportMonthFile(roster, event)}><Download className="mr-1.5 h-4 w-4" />Export tháng</Button></div></div>)}
        {!loading && result.content.length === 0 && <div className="col-span-full"><HrEmpty title="Chưa có danh sách tháng" description="Danh sách T6-26 sẽ xuất hiện sau khi dữ liệu ban đầu được xác nhận." /></div>}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </HrPageShell>
  );
}

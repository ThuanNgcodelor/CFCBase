import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, Download, Eye, TableProperties, Users } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrReadOnlyNotice } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatPeriod, nonEmpty } from '../../utils/hr';

function formatPeriodRange(periodStart) {
  const [year, month] = String(periodStart || '').slice(0, 10).split('-').map(Number);
  if (!year || !month) return '—';
  const lastDay = new Date(year, month, 0).getDate();
  return `01/${String(month).padStart(2, '0')}/${year} – ${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export default function HrRosters() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
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

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Danh sách nhân sự theo tháng" url="https://cfcbooking.io.vn/manager/hr/rosters" />
      <HrPageHeader
        title="Danh sách nhân sự theo tháng"
        description="Hệ thống tự tính quân số từng tháng từ T6-26 theo ngày hiệu lực của các biến động đã xác nhận."
        actions={(
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--cfc-border)] bg-white px-2 shadow-[var(--cfc-shadow-sm)]">
            <label htmlFor="hr-export-year" className="pl-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cfc-muted)]">Năm</label>
            <input
              id="hr-export-year"
              type="number"
              min="2000"
              max="2100"
              value={exportYear}
              onChange={(event) => setExportYear(Number(event.target.value))}
              className="h-9 w-20 rounded-md border-0 bg-[var(--cfc-surface-muted)] px-2 text-sm font-semibold text-[var(--cfc-ink)] outline-none focus:ring-2 focus:ring-blue-100"
            />
            <Button type="button" size="sm" variant="secondary" disabled={exporting === 'year'} onClick={exportYearFile}>
              <Download className="mr-1.5 h-4 w-4" />Export năm
            </Button>
          </div>
        )}
      />
      <div className="mb-4"><HrReadOnlyNotice>Tháng hiện tại tự xuất hiện. Khi xác nhận Tăng/Giảm, tháng hiệu lực và các tháng sau tự cập nhật lại quân số.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <section className="overflow-hidden rounded-xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-sm)]">
        <div className="hr-roster-ledger-desktop grid-cols-[1.1fr_0.75fr_0.75fr_1.45fr] border-b border-[var(--cfc-border)] bg-[var(--cfc-surface-muted)] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cfc-muted)]">
          <span>Tháng</span>
          <span>Quân số</span>
          <span>Cách tính</span>
          <span>Thao tác</span>
        </div>
        {loading ? (
          <div className="py-14 text-center text-sm text-[var(--cfc-muted)]">Đang tải...</div>
        ) : (
          <>
            <div className="hr-roster-ledger-desktop hr-roster-timeline">
              {result.content.map((roster, index) => (
                <article
                  key={roster.id}
                  className={`relative grid grid-cols-[1.1fr_0.75fr_0.75fr_1.45fr] items-center gap-5 px-8 py-7 transition hover:bg-slate-50/70 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <span className={`hr-roster-timeline-dot ${index === 0 ? 'is-open' : ''}`} aria-hidden="true" />
                  <div className="pl-9">
                    <p className="text-xl font-semibold tracking-tight text-[var(--cfc-ink)]">{formatPeriod(roster.periodStart)}</p>
                    <p className="mt-1 text-xs text-[var(--cfc-muted)]">{formatPeriodRange(roster.periodStart)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Users className="h-5 w-5" />
                    <p><strong className="text-xl font-semibold">{nonEmpty(roster.itemCount)}</strong> <span className="text-sm">nhân sự</span></p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {roster.baseline && <span className="inline-flex min-w-max items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Nền T6</span>}
                    <span className="inline-flex min-w-max items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Tự động</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openRosterDetail(roster)}><Eye className="mr-1.5 h-4 w-4" />Xem danh sách</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={exporting === roster.id} onClick={(event) => exportMonthFile(roster, event)}><Download className="mr-1.5 h-4 w-4" />Export tháng</Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hr-roster-ledger-mobile space-y-3 p-3">
              {result.content.map((roster) => (
                <article key={roster.id} className="rounded-lg border border-[var(--cfc-border)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><TableProperties className="h-5 w-5" /></span>
                      <div>
                        <p className="text-lg font-semibold text-[var(--cfc-ink)]">{formatPeriod(roster.periodStart)}</p>
                        <p className="mt-0.5 text-xs text-[var(--cfc-muted)]">{formatPeriodRange(roster.periodStart)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {roster.baseline && <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">Nền T6</span>}
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">Tự động</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--cfc-surface-muted)] px-3 py-3">
                    <span className="text-xs text-[var(--cfc-muted)]">Quân số cuối tháng</span>
                    <span className="text-base font-semibold text-emerald-700">{nonEmpty(roster.itemCount)} nhân sự</span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Tính từ biến động có hiệu lực đến cuối tháng</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openRosterDetail(roster)}><Eye className="mr-1.5 h-4 w-4" />Danh sách</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={exporting === roster.id} onClick={(event) => exportMonthFile(roster, event)}><Download className="mr-1.5 h-4 w-4" />Export</Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {!loading && result.content.length === 0 && <div className="p-5"><HrEmpty title="Chưa có danh sách tháng" description="Danh sách T6-26 sẽ xuất hiện sau khi dữ liệu ban đầu được xác nhận." /></div>}
      </section>

      {!loading && result.content.length > 0 && (
        <aside className="mt-5 grid gap-4 rounded-xl border border-[var(--cfc-border)] bg-white p-5 text-sm text-gray-600 shadow-[var(--cfc-shadow-sm)] sm:grid-cols-[auto_1fr] sm:p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700"><CalendarClock className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold text-[var(--cfc-ink)]">Cách tính danh sách tháng</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              <li><strong className="text-gray-700">Tự động:</strong> tháng hiện tại tự xuất hiện, không cần tạo hoặc chốt thủ công.</li>
              <li><strong className="text-gray-700">Ngày hiệu lực:</strong> biến động tháng nào sẽ làm thay đổi tháng đó và các tháng sau.</li>
              <li><strong className="text-gray-700">Nền T6:</strong> dữ liệu ban đầu dùng làm mốc tính từ tháng 6/2026.</li>
            </ul>
          </div>
        </aside>
      )}
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </HrPageShell>
  );
}

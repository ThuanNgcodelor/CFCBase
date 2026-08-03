import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  FileSpreadsheet,
  History,
  UsersRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { formatDateDisplay } from '../lib/format.js';

const periodStartOf = (roster) => roster.periodStart || roster.startDate || '';

const labelOf = (roster) => {
  if (roster.label) return roster.label;
  const match = String(periodStartOf(roster)).match(/^(\d{4})-(\d{2})/);
  return match ? `T${Number(match[2])}-${String(match[1]).slice(-2)}` : 'Tháng';
};

const rangeOf = (roster) => {
  if (roster.range) return roster.range;
  const match = String(periodStartOf(roster)).match(/^(\d{4})-(\d{2})/);
  if (!match) return '—';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return `01/${String(month).padStart(2, '0')}/${year} – ${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

const headcountOf = (roster) => roster?.employeeCount ?? roster?.itemCount ?? roster?.headcount ?? 0;
const movementCountOf = (roster) => roster?.movementCount ?? roster?.appliedMovementCount ?? 0;
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

const periodOf = (roster) => {
  const source = String(periodStartOf(roster) || roster?.range || '');
  const isoMatch = source.match(/\b(20\d{2})-(\d{1,2})\b/);
  if (isoMatch) return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };

  const displayMatch = source.match(/\b\d{1,2}\/(\d{1,2})\/(20\d{2})\b/);
  if (displayMatch) return { year: Number(displayMatch[2]), month: Number(displayMatch[1]) };
  return null;
};

const safeWorkbookName = (fileName, year, month) => {
  const fallback = `Danh sách nhân sự tháng ${String(month).padStart(2, '0')}-${year}.xlsx`;
  const normalized = String(fileName || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim();
  return normalized || fallback;
};

const downloadWorkbook = (result, year, month) => {
  const encoded = String(result?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!encoded) return false;

  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], {
    type: result?.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = safeWorkbookName(result?.fileName, year, month);
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return true;
};

const openExportUrl = (result) => {
  const url = typeof result === 'string' ? result : result?.url;
  if (!url) return false;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
  return true;
};

export function RostersPage() {
  const {
    rosters,
    loading,
    error,
    reload,
    notify,
    exportMonthlyWorkbook,
    getMonthlyExportUrl
  } = useAppData();
  const availablePeriods = useMemo(() => {
    const unique = new Map();
    rosters.forEach((roster) => {
      const period = periodOf(roster);
      if (!period) return;
      unique.set(`${period.year}-${period.month}`, period);
    });
    return [...unique.values()].sort((left, right) =>
      right.year - left.year || right.month - left.month
    );
  }, [rosters]);
  const years = useMemo(
    () => [...new Set(availablePeriods.map((period) => String(period.year)))],
    [availablePeriods]
  );
  const [year, setYear] = useState(years[0] || null);
  const [exportYear, setExportYear] = useState('');
  const [exportMonth, setExportMonth] = useState('');
  const [exportingPeriod, setExportingPeriod] = useState('');

  useEffect(() => {
    if (year === null && years[0]) setYear(years[0]);
  }, [year, years]);

  useEffect(() => {
    if (loading || exportYear || exportMonth) return;
    const latestPeriod = availablePeriods[0];
    const now = new Date();
    setExportYear(String(latestPeriod?.year || now.getFullYear()));
    setExportMonth(String(latestPeriod?.month || now.getMonth() + 1));
  }, [availablePeriods, exportMonth, exportYear, loading]);

  const visibleRosters = useMemo(() => rosters.filter((roster) => {
    if (!year) return true;
    return String(periodStartOf(roster) || roster.range || '').includes(year);
  }), [rosters, year]);

  const latest = visibleRosters[0];
  const baseline = [...visibleRosters].reverse().find((roster) => roster.status === 'BASELINE' || roster.baseline);
  const delta = latest && baseline ? headcountOf(latest) - headcountOf(baseline) : 0;
  const selectedExportLabel = exportYear && exportMonth
    ? `T${Number(exportMonth)}-${String(exportYear).slice(-2)}`
    : 'tháng đã chọn';
  const numericExportYear = Number(exportYear);
  const canExportSelectedPeriod = Number.isInteger(numericExportYear)
    && numericExportYear >= 2000
    && numericExportYear <= 2100
    && Number(exportMonth) >= 1
    && Number(exportMonth) <= 12;

  const exportRoster = async (roster) => {
    const period = periodOf(roster);
    if (!period) {
      notify('Không xác định được tháng cần xuất.', 'error');
      return;
    }

    const periodKey = `${period.year}-${String(period.month).padStart(2, '0')}`;
    setExportingPeriod(periodKey);
    try {
      const result = await exportMonthlyWorkbook(period.year, period.month);
      if (downloadWorkbook(result, period.year, period.month)) {
        notify(`Đã tải báo cáo nhân sự tháng ${period.month}/${period.year}.`);
      } else if (openExportUrl(result)) {
        notify('Đã mở file xuất trong cửa sổ mới.');
      } else {
        const fallback = await getMonthlyExportUrl(period.year, period.month);
        if (!openExportUrl(fallback)) {
          throw new Error('Server không trả về nội dung hoặc liên kết file XLSX.');
        }
      }
    } catch (requestError) {
      const unavailableRpc = /apiExportMonthlyWorkbook|script function not found|chưa được triển khai/i
        .test(requestError?.message || '');
      if (unavailableRpc) {
        try {
          const fallback = await getMonthlyExportUrl(period.year, period.month);
          if (openExportUrl(fallback)) return;
        } catch {
          // Giữ lỗi RPC ban đầu để người dùng biết deployment chưa có API mới.
        }
      }
      notify(requestError.message || 'Không thể tạo file XLSX tháng đã chọn.', 'error');
    } finally {
      setExportingPeriod('');
    }
  };

  return (
    <section className="rosters-page">
      <PageHeader
        title="Danh sách nhân sự theo tháng"
        description="Số liệu sống được chiếu từ baseline và các biến động đã xác nhận; không cần thao tác mở hoặc khóa tháng."
      />

      <section className="roster-export-panel surface" aria-labelledby="roster-export-title">
        <div className="roster-export-panel__intro">
          <span className="roster-export-panel__icon"><Download aria-hidden="true" /></span>
          <div>
            <span className="roster-export-panel__eyebrow">Xuất báo cáo tiếng Việt</span>
            <h2 id="roster-export-title">Chọn tháng và năm cần tải</h2>
            <p>Có thể chọn tháng cũ ngay cả khi lịch sử bên dưới chỉ đang có kỳ hiện tại.</p>
          </div>
        </div>
        <div className="roster-export-panel__controls">
          <label>
            <span>Tháng</span>
            <select
              aria-label="Tháng xuất báo cáo"
              value={exportMonth}
              disabled={Boolean(exportingPeriod)}
              onChange={(event) => setExportMonth(event.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>Tháng {month}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Năm</span>
            <input
              type="number"
              aria-label="Năm xuất báo cáo"
              value={exportYear}
              min="2000"
              max="2100"
              step="1"
              inputMode="numeric"
              disabled={Boolean(exportingPeriod)}
              onChange={(event) => setExportYear(event.target.value)}
            />
          </label>
          <Button
            disabled={!canExportSelectedPeriod || Boolean(exportingPeriod)}
            onClick={() => exportRoster({
              periodStart: `${exportYear}-${String(exportMonth).padStart(2, '0')}-01`
            })}
          >
            <Download aria-hidden="true" />
            {exportingPeriod ? 'Đang tạo file...' : `Tải XLSX ${selectedExportLabel}`}
          </Button>
        </div>
      </section>

      <section className="roster-live-banner">
        <div className="roster-live-banner__icon"><FileSpreadsheet /></div>
        <div>
          <span className="roster-live-banner__eyebrow">Danh sách dự phóng trực tiếp</span>
          <h2>{latest ? `${labelOf(latest)} · ${headcountOf(latest).toLocaleString('vi-VN')} nhân sự` : 'Chưa có dữ liệu tháng'}</h2>
          <p>Mỗi biến động đã xác nhận được áp dụng theo ngày hiệu lực, giữ nguyên dữ liệu nền để đối soát.</p>
        </div>
        {latest ? <StatusBadge status={latest.status || 'LIVE'} label={latest.status === 'BASELINE' ? 'Baseline' : 'Số liệu sống'} /> : null}
      </section>

      <div className="roster-summary">
        <article className="surface roster-summary__item">
          <span><UsersRound /></span>
          <div><small>Nhân sự hiện tại</small><strong>{headcountOf(latest).toLocaleString('vi-VN')}</strong></div>
        </article>
        <article className="surface roster-summary__item">
          <span><History /></span>
          <div><small>Biến động đã áp dụng</small><strong>{movementCountOf(latest).toLocaleString('vi-VN')}</strong></div>
        </article>
        <article className="surface roster-summary__item">
          <span className={delta < 0 ? 'roster-summary__down' : 'roster-summary__up'}>{delta < 0 ? <ArrowDown /> : <ArrowUp />}</span>
          <div><small>So với baseline</small><strong>{delta > 0 ? '+' : ''}{delta}</strong></div>
        </article>
      </div>

      <div className="roster-toolbar surface">
        <div>
          <CalendarDays />
          <span><strong>Lịch sử danh sách tháng</strong><small>Chọn năm để xem chuỗi số liệu.</small></span>
        </div>
        <select value={year || ''} onChange={(event) => setYear(event.target.value)}>
          <option value="">Tất cả năm</option>
          {years.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {error ? (
        <div className="surface"><ErrorState message={error} onRetry={reload} /></div>
      ) : loading ? (
        <div className="surface"><LoadingState label="Đang tải danh sách tháng..." /></div>
      ) : visibleRosters.length ? (
        <div className="roster-timeline surface">
          {visibleRosters.map((roster, index) => (
            <article key={roster.id || `${periodStartOf(roster)}-${index}`} className="roster-timeline__item">
              <div className="roster-timeline__rail">
                <span className={roster.status === 'BASELINE' || roster.baseline ? 'roster-timeline__dot roster-timeline__dot--baseline' : 'roster-timeline__dot'} />
              </div>
              <div className="roster-timeline__month">
                <strong>{labelOf(roster)}</strong>
                <small>{rangeOf(roster)}</small>
              </div>
              <div className="roster-timeline__metrics">
                <span><small>Nhân sự</small><strong>{headcountOf(roster).toLocaleString('vi-VN')}</strong></span>
                <span><small>Biến động áp dụng</small><strong>{movementCountOf(roster)}</strong></span>
              </div>
              <StatusBadge status={roster.status || (roster.baseline ? 'BASELINE' : 'LIVE')} label={roster.status === 'BASELINE' || roster.baseline ? 'Baseline' : 'Số liệu sống'} />
              <Button
                size="sm"
                variant="secondary"
                disabled={Boolean(exportingPeriod)}
                onClick={() => exportRoster(roster)}
              >
                <Download />
                {exportingPeriod === `${periodOf(roster)?.year}-${String(periodOf(roster)?.month || '').padStart(2, '0')}`
                  ? 'Đang tạo...'
                  : 'Tải XLSX'}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface"><EmptyState title="Chưa có danh sách tháng" description="Danh sách sẽ xuất hiện sau khi dữ liệu baseline được khởi tạo." /></div>
      )}

      <p className="roster-note">
        <FileSpreadsheet /> Danh sách tháng là bản chiếu đọc-only. Thay đổi nhân sự được thực hiện tại mục Tăng / Giảm.
      </p>
    </section>
  );
}

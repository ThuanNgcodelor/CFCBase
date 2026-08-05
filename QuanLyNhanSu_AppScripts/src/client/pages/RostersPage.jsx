import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  FileSpreadsheet,
  History,
  UsersRound
} from 'lucide-react';
import { useMemo, useState } from 'react';
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

export function RostersPage() {
  const { rosters, loading, error, reload, notify, getMonthlyExportUrl } = useAppData();
  const years = useMemo(() => {
    const available = rosters.map((roster) => {
      const match = String(periodStartOf(roster) || roster.range || '').match(/\b(20\d{2})\b/);
      return match?.[1];
    }).filter(Boolean);
    return [...new Set(available)].sort((a, b) => b.localeCompare(a));
  }, [rosters]);
  const [year, setYear] = useState(years[0] || '');

  const visibleRosters = useMemo(() => rosters.filter((roster) => {
    if (!year) return true;
    return String(periodStartOf(roster) || roster.range || '').includes(year);
  }), [rosters, year]);

  const latest = visibleRosters[0];
  const baseline = [...visibleRosters].reverse().find((roster) => roster.status === 'BASELINE' || roster.baseline);
  const delta = latest && baseline ? headcountOf(latest) - headcountOf(baseline) : 0;

  const exportRoster = async () => {
    try {
      const exportYear = year || String(new Date().getFullYear());
      const result = await getMonthlyExportUrl(exportYear);
      const url = typeof result === 'string' ? result : result?.url;
      if (!url) {
        notify('Chưa có liên kết XLSX khả dụng để tải xuống.', 'info');
        return;
      }
      notify(`Đã làm mới sheet ${result?.sheetName || `PHEP_NAM_${exportYear}`} trước khi tải workbook.`, 'success');
      const popup = globalThis.open(url, '_blank', 'noopener');
      if (!popup) {
        globalThis.location.assign(url);
      }
    } catch (requestError) {
      notify(requestError.message || 'Không thể lấy liên kết XLSX.', 'error');
    }
  };

  return (
    <section className="rosters-page">
      <PageHeader
        title="Danh sách nhân sự theo tháng"
        description="Số liệu sống được chiếu từ baseline và các biến động đã xác nhận; workbook export sẽ kèm sheet tổng hợp ngày phép của năm đang chọn."
        actions={latest ? (
          <Button onClick={exportRoster}>
            <Download aria-hidden="true" />Tải workbook XLSX
          </Button>
        ) : null}
      />

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
        <select value={year} onChange={(event) => setYear(event.target.value)}>
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
              <Button size="sm" variant="secondary" onClick={exportRoster}><Download />Tải XLSX</Button>
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

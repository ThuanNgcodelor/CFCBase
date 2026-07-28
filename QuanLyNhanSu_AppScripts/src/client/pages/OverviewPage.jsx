import {
  ArrowDownUp,
  CalendarDays,
  ChevronRight,
  FileText,
  UserRoundCheck,
  UserRoundMinus,
  UsersRound,
  ClipboardCheck
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

const statItems = [
  { key: 'total', label: 'Tổng hồ sơ', icon: UsersRound, tone: 'success' },
  { key: 'active', label: 'Đang làm việc', icon: UserRoundCheck, tone: 'success' },
  { key: 'draft', label: 'Bản nháp', icon: FileText, tone: 'info' },
  { key: 'inactive', label: 'Ngừng hoạt động', icon: UserRoundMinus, tone: 'danger' }
];

const quickLinks = [
  {
    label: 'Danh sách nhân sự',
    description: 'Xem, tìm kiếm và quản lý hồ sơ nhân sự.',
    path: '/employees',
    icon: UsersRound
  },
  {
    label: 'Tăng / Giảm',
    description: 'Quản lý nhân sự tăng mới hoặc giảm.',
    path: '/movements',
    icon: ArrowDownUp
  },
  {
    label: 'Danh sách theo tháng',
    description: 'Theo dõi biến động nhân sự theo từng tháng.',
    path: '/rosters',
    icon: CalendarDays
  },
  {
    label: 'Thử việc',
    description: 'Theo dõi và quản lý nhân sự trong thời gian thử việc.',
    path: '/probation',
    icon: ClipboardCheck
  }
];

export function OverviewPage({ navigate }) {
  const { overview, loading, error, reload } = useAppData();

  return (
    <section className="overview-page">
      <PageHeader
        title="Tổng quan nhân sự"
        description="Tổng hợp tình hình nhân sự toàn công ty tại thời điểm hiện tại."
      />

      {error ? <div className="page-state-wrap"><ErrorState message={error} onRetry={reload} /></div> : null}

      <div className="summary-band surface" aria-label="Tổng hợp hồ sơ nhân sự">
        {loading ? (
          <div className="summary-band__loading"><LoadingState label="Đang tổng hợp nhân sự..." /></div>
        ) : statItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.key} className={`summary-item summary-item--${item.tone}`}>
              <span className="summary-item__icon"><Icon aria-hidden="true" /></span>
              <span className="summary-item__copy">
                <span>{item.label}</span>
                <strong>{Number(overview[item.key] || 0).toLocaleString('vi-VN')}</strong>
              </span>
            </article>
          );
        })}
      </div>

      <section className="quick-access">
        <h2>Truy cập nhanh</h2>
        <div className="quick-ledger surface">
          <div className="quick-ledger__heading" aria-hidden="true">
            <span>Chức năng</span>
            <span>Mô tả</span>
          </div>
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                className="quick-ledger__row"
                onClick={() => navigate(item.path)}
              >
                <span className="quick-ledger__icon"><Icon aria-hidden="true" /></span>
                <strong>{item.label}</strong>
                <span className="quick-ledger__description">{item.description}</span>
                <span className="quick-ledger__cta">
                  <span className="quick-ledger__button-label">Xem ngay</span>
                  <ChevronRight aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

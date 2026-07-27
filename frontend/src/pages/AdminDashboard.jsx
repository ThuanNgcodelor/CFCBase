import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Car, ClipboardCheck, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboardApi';
import { formatViDate, formatViTime } from '../utils/dateTime';
import { BookingEmptyState } from '../components/booking/BookingEmptyState';
import { BookingStatusBadge } from '../components/booking/BookingStatusBadge';
import { BookingPageHeader } from '../components/booking/BookingPageHeader';
import { Surface } from '../components/ui/Surface';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeRooms: 0,
    totalRooms: 0,
    activeCars: 0,
    totalCars: 0,
    pendingApprovals: 0,
    todayActivities: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    dashboardApi.getAdminStats()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Không tải được dữ liệu điều phối.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openActivityDetail = (activity) => {
    if (activity?.id) navigate(`/admin/approvals/${activity.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1">
      <BookingPageHeader
        eyebrow="Điều phối hệ thống"
        title="Trung tâm điều phối"
        description="Theo dõi tài nguyên đang sẵn sàng và xử lý các yêu cầu đặt chỗ."
        actions={(
          <button
            type="button"
            onClick={() => navigate('/admin/approvals')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--cfc-cobalt)] bg-[var(--cfc-cobalt)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--cfc-cobalt-dark)]"
          >
            <ClipboardCheck className="h-4 w-4" />
            Mở khu duyệt
          </button>
        )}
        className="mb-6"
      />

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Building2}
          label="Phòng sẵn sàng"
          value={loading ? '—' : `${stats.activeRooms}/${stats.totalRooms}`}
          caption="Tài nguyên phòng đang hoạt động"
          tone="room"
          onClick={() => navigate('/rooms')}
        />
        <MetricCard
          icon={Car}
          label="Xe sẵn sàng"
          value={loading ? '—' : `${stats.activeCars}/${stats.totalCars}`}
          caption="Tài nguyên xe đang hoạt động"
          tone="vehicle"
          onClick={() => navigate('/cars')}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Yêu cầu chờ duyệt"
          value={loading ? '—' : stats.pendingApprovals}
          caption={stats.pendingApprovals > 0 ? 'Có yêu cầu cần xử lý' : 'Không có yêu cầu tồn đọng'}
          tone="pending"
          onClick={() => navigate('/admin/approvals')}
        />
      </div>

      <Surface className="mt-7 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cfc-border)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--cfc-ink)]">Hoạt động trong ngày</h2>
            <p className="mt-1 text-sm text-[var(--cfc-muted)]">Các booking đã duyệt diễn ra hôm nay.</p>
          </div>
          <button type="button" onClick={() => navigate('/rooms')} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[var(--cfc-cobalt)] hover:text-[var(--cfc-cobalt-dark)]">
            Xem lịch chi tiết <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-sm text-[var(--cfc-muted)]">Đang tải hoạt động...</div>
        ) : stats.todayActivities?.length > 0 ? (
          <div className="divide-y divide-[var(--cfc-border)]">
            {stats.todayActivities.map((activity) => (
              <button
                key={`${activity.type}-${activity.id}`}
                type="button"
                onClick={() => openActivityDetail(activity)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-5 sm:px-6"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  activity.type === 'ROOM' ? 'bg-blue-50 text-[var(--cfc-room)]' : 'bg-teal-50 text-[var(--cfc-vehicle)]'
                }`}>
                  {activity.type === 'ROOM' ? <Building2 className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--cfc-ink)]">{activity.title}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--cfc-muted)]">
                    {activity.subtitle} · {activity.requesterName}
                  </span>
                </span>
                <span className="col-start-2 text-xs font-medium text-[var(--cfc-ink)] sm:col-start-auto sm:text-right">
                  <span className="block">{formatViTime(activity.startTime)} – {formatViTime(activity.endTime)}</span>
                  <span className="mt-1 block font-normal text-[var(--cfc-muted)]">{formatViDate(activity.startTime)}</span>
                </span>
                <span className="col-start-2 sm:col-start-auto"><BookingStatusBadge status={activity.status} /></span>
              </button>
            ))}
          </div>
        ) : (
          <BookingEmptyState
            icon={Clock3}
            title="Chưa có hoạt động hôm nay"
            description="Các booking đã duyệt và diễn ra trong ngày sẽ xuất hiện tại đây."
          />
        )}
      </Surface>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption, tone, onClick }) {
  const tones = {
    room: 'bg-blue-50 text-[var(--cfc-room)]',
    vehicle: 'bg-teal-50 text-[var(--cfc-vehicle)]',
    pending: 'bg-amber-50 text-[var(--cfc-amber)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="cfc-app-surface group flex min-h-36 w-full items-start gap-4 p-5 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--cfc-border-strong)] hover:shadow-md"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--cfc-muted)]">{label}</span>
        <span className="mt-1 block text-3xl font-bold tracking-tight text-[var(--cfc-ink)]">{value}</span>
        <span className="mt-2 block text-xs leading-5 text-[var(--cfc-muted)]">{caption}</span>
      </span>
    </button>
  );
}

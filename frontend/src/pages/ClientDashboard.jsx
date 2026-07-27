import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Car, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboardApi';
import { formatViDate, formatViTime } from '../utils/dateTime';
import { BookingEmptyState } from '../components/booking/BookingEmptyState';
import { BookingStatusBadge } from '../components/booking/BookingStatusBadge';
import { Surface } from '../components/ui/Surface';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    dashboardApi.getClientStats()
      .then((data) => {
        if (active) setUpcoming(data.upcomingBookings || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Không tải được lịch trình sắp tới.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openDetail = (activity) => {
    if (activity?.id) navigate(`/admin/approvals/${activity.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1">
      <header className="mb-7 sm:mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cfc-emerald-dark)]">
          Bàn điều phối cá nhân
        </p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[var(--cfc-ink)] sm:text-4xl">
          Hôm nay bạn cần đặt gì?
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--cfc-muted)] sm:text-base">
          Đặt phòng họp hoặc xe công tác nhanh chóng để công việc luôn suôn sẻ.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickAction
          icon={Building2}
          title="Đặt phòng họp"
          description="Tìm và đặt phòng phù hợp cho cuộc họp của bạn."
          tone="room"
          onClick={() => navigate('/rooms/create')}
        />
        <QuickAction
          icon={Car}
          title="Đặt xe công tác"
          description="Đăng ký xe phục vụ công tác và theo dõi yêu cầu."
          tone="vehicle"
          onClick={() => navigate('/cars/create')}
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Surface className="overflow-hidden">
        <div className="border-b border-[var(--cfc-border)] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-[var(--cfc-ink)]">Lịch trình sắp tới</h2>
          <p className="mt-1 text-sm text-[var(--cfc-muted)]">Các yêu cầu phòng và xe trong thời gian tới.</p>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-sm text-[var(--cfc-muted)]">Đang tải lịch trình...</div>
        ) : upcoming.length > 0 ? (
          <>
            <UpcomingDesktop rows={upcoming} onOpen={openDetail} />
            <UpcomingMobile rows={upcoming} onOpen={openDetail} />
          </>
        ) : (
          <BookingEmptyState
            icon={CalendarClock}
            title="Bạn chưa có lịch trình sắp tới"
            description="Các phòng họp hoặc xe công tác đã đăng ký sẽ xuất hiện tại đây."
          />
        )}
      </Surface>
    </div>
  );
}

function QuickAction({ icon: Icon, title, description, tone, onClick }) {
  const isRoom = tone === 'room';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-36 items-center gap-4 rounded-xl border bg-white p-5 text-left shadow-[var(--cfc-shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md sm:gap-6 sm:p-6 ${
        isRoom ? 'border-blue-300 hover:border-[var(--cfc-room)]' : 'border-teal-300 hover:border-[var(--cfc-vehicle)]'
      }`}
    >
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl sm:h-20 sm:w-20 ${
        isRoom ? 'bg-blue-50 text-[var(--cfc-room)]' : 'bg-teal-50 text-[var(--cfc-vehicle)]'
      }`}>
        <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-[var(--cfc-ink)]">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--cfc-muted)]">{description}</span>
      </span>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors ${
        isRoom ? 'bg-[var(--cfc-cobalt)] group-hover:bg-[var(--cfc-cobalt-dark)]' : 'bg-[var(--cfc-vehicle)] group-hover:bg-teal-700'
      }`}>
        <ArrowRight className="h-5 w-5" />
      </span>
    </button>
  );
}

function UpcomingDesktop({ rows, onOpen }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full">
        <thead className="bg-[var(--cfc-surface-muted)] text-left">
          <tr className="cfc-data-label">
            <th className="px-6 py-3">Loại</th>
            <th className="px-6 py-3">Tiêu đề</th>
            <th className="px-6 py-3">Tài nguyên</th>
            <th className="px-6 py-3">Thời gian</th>
            <th className="px-6 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--cfc-border)]">
          {rows.map((activity) => (
            <tr
              key={`${activity.type}-${activity.id}`}
              tabIndex={0}
              onClick={() => onOpen(activity)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(activity);
                }
              }}
              className="cursor-pointer transition-colors hover:bg-slate-50 focus:bg-blue-50/50 focus:outline-none"
            >
              <td className="px-6 py-4"><BookingTypeIcon type={activity.type} /></td>
              <td className="px-6 py-4 text-sm font-semibold text-[var(--cfc-ink)]">{activity.title}</td>
              <td className="px-6 py-4 text-sm text-[var(--cfc-muted)]">{activity.subtitle}</td>
              <td className="whitespace-nowrap px-6 py-4">
                <p className="text-sm font-medium text-[var(--cfc-ink)]">
                  {formatViDate(activity.startTime, { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </p>
                <p className="mt-1 text-xs text-[var(--cfc-muted)]">
                  {formatViTime(activity.startTime)} – {formatViTime(activity.endTime)}
                </p>
              </td>
              <td className="px-6 py-4"><BookingStatusBadge status={activity.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UpcomingMobile({ rows, onOpen }) {
  return (
    <div className="divide-y divide-[var(--cfc-border)] md:hidden">
      {rows.map((activity) => (
        <button
          key={`${activity.type}-${activity.id}`}
          type="button"
          onClick={() => onOpen(activity)}
          className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-slate-50"
        >
          <BookingTypeIcon type={activity.type} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--cfc-ink)]">{activity.title}</span>
            <span className="mt-1 block truncate text-xs text-[var(--cfc-muted)]">{activity.subtitle}</span>
            <span className="mt-2 block text-xs font-medium text-[var(--cfc-ink)]">
              {formatViDate(activity.startTime, { day: '2-digit', month: '2-digit' })} · {formatViTime(activity.startTime)} – {formatViTime(activity.endTime)}
            </span>
          </span>
          <BookingStatusBadge status={activity.status} className="shrink-0" />
        </button>
      ))}
    </div>
  );
}

function BookingTypeIcon({ type }) {
  const isRoom = type === 'ROOM';
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
      isRoom ? 'bg-blue-50 text-[var(--cfc-room)]' : 'bg-teal-50 text-[var(--cfc-vehicle)]'
    }`}>
      {isRoom ? <Building2 className="h-5 w-5" /> : <Car className="h-5 w-5" />}
    </span>
  );
}

import React, { useEffect } from 'react';
import {
  Building2,
  CalendarDays,
  Car,
  FileText,
  MapPin,
  User,
  Users,
  X,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { BookingStatusBadge } from '../booking/BookingStatusBadge';
import { formatViDate, formatViDateTime, formatViTime } from '../../utils/dateTime';

export function ApprovalPreviewDrawer({ request, onClose, onOpenDetail }) {
  useEffect(() => {
    if (!request) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, request]);

  if (!request) return null;

  const isRoom = request.type === 'ROOM';
  const raw = request.raw || {};

  return (
    <div className="fixed inset-0 z-[65]">
      <button
        type="button"
        aria-label="Đóng xem nhanh"
        className="absolute inset-0 h-full w-full bg-[var(--cfc-navy)]/35 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Xem nhanh yêu cầu"
        className="cfc-safe-bottom absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-panel)] md:inset-y-0 md:left-auto md:w-[430px] md:max-h-none md:rounded-none md:border-y-0 md:border-r-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cfc-border)] px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--cfc-emerald-dark)]">Xem nhanh yêu cầu</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--cfc-ink)]">{request.purpose}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--cfc-muted)] hover:bg-slate-100 hover:text-[var(--cfc-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cfc-scrollbar flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-center gap-3 border-b border-[var(--cfc-border)] pb-5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isRoom ? 'bg-blue-50 text-[var(--cfc-room)]' : 'bg-teal-50 text-[var(--cfc-vehicle)]'}`}>
              {isRoom ? <Building2 className="h-6 w-6" /> : <Car className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--cfc-ink)]">{request.resourceName}</p>
              <p className="mt-1 text-xs text-[var(--cfc-muted)]">Mã: {request.id}</p>
            </div>
            <BookingStatusBadge status="PENDING" />
          </div>

          <PreviewSection title="Thông tin yêu cầu">
            <PreviewRow icon={isRoom ? Building2 : Car} label="Loại yêu cầu" value={isRoom ? 'Phòng họp' : 'Xe công tác'} />
            <PreviewRow icon={CalendarDays} label="Thời gian" value={`${formatViDate(raw.startTime)} · ${formatViTime(raw.startTime)} – ${formatViTime(raw.endTime)}`} />
            {isRoom ? (
              <PreviewRow icon={Users} label="Số người dự kiến" value={`${raw.attendeeCount || 0} người`} />
            ) : (
              <PreviewRow icon={MapPin} label="Hành trình" value={`${raw.departure || 'Chưa có điểm đón'} → ${raw.destination || 'Chưa có điểm đến'}`} />
            )}
            <PreviewRow icon={User} label="Người đặt" value={request.booker.fullName || 'Không rõ'} />
          </PreviewSection>

          <PreviewSection title="Người yêu cầu">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--cfc-border)] p-3">
              <Avatar src={request.booker.avatar} name={request.booker.fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--cfc-ink)]">{request.booker.fullName || 'Không rõ'}</p>
                <p className="mt-1 truncate text-xs text-[var(--cfc-muted)]">{request.booker.department}</p>
              </div>
            </div>
          </PreviewSection>

          <PreviewSection title="Nội dung yêu cầu">
            <div className="rounded-lg bg-[var(--cfc-surface-muted)] p-4">
              <p className="text-xs font-semibold text-[var(--cfc-muted)]">Tiêu đề</p>
              <p className="mt-1 text-sm font-semibold text-[var(--cfc-ink)]">{request.purpose}</p>
              <p className="mt-4 text-xs font-semibold text-[var(--cfc-muted)]">Ghi chú của người đặt</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cfc-ink)]">{raw.note || 'Không có ghi chú'}</p>
            </div>
            {raw.createdAt && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--cfc-muted)]">
                <FileText className="h-3.5 w-3.5" />
                Tạo lúc {formatViDateTime(raw.createdAt)}
              </p>
            )}
          </PreviewSection>
        </div>

        <div className="flex gap-3 border-t border-[var(--cfc-border)] bg-white px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Đóng</Button>
          <Button className="flex-1" onClick={() => onOpenDetail(request)}>Mở xử lý</Button>
        </div>
      </aside>
    </div>
  );
}

function PreviewSection({ title, children }) {
  return (
    <section className="border-b border-[var(--cfc-border)] py-5 last:border-b-0">
      <h3 className="text-sm font-bold text-[var(--cfc-ink)]">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function PreviewRow({ icon: Icon, label, value }) {
  return (
    <div className="grid grid-cols-[20px_112px_minmax(0,1fr)] gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-[var(--cfc-muted)]" />
      <span className="text-[var(--cfc-muted)]">{label}</span>
      <span className="font-medium leading-5 text-[var(--cfc-ink)]">{value}</span>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlignLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Timer,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { BookingFormShell, BookingSummaryItem } from '../components/booking/BookingFormShell';
import { resourceApi } from '../api/resourceApi';
import { bookingApi } from '../api/bookingApi';
import {
  formatViDate,
  formatViTime,
  parseApiDateTime,
  toApiLocalDateTime,
  toDateTimeLocalValue,
} from '../utils/dateTime';

const INPUT_CLASS = 'min-h-11 w-full rounded-lg border border-[var(--cfc-border)] bg-white px-3 py-2 text-sm text-[var(--cfc-ink)] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100';
const ICON_INPUT_CLASS = `${INPUT_CLASS} pl-10`;

export default function CreateRoomBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedStart = location.state?.start ? new Date(location.state.start) : new Date();
  const preSelectedEnd = location.state?.end
    ? new Date(location.state.end)
    : new Date(preSelectedStart.getTime() + 60 * 60 * 1000);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    roomId: '',
    startTime: toDateTimeLocalValue(preSelectedStart),
    endTime: toDateTimeLocalValue(preSelectedEnd),
    attendeeCount: '',
    note: '',
  });

  useEffect(() => {
    let active = true;
    resourceApi.getRooms()
      .then((data) => {
        if (!active) return;
        setRooms(data || []);
        if (data?.length > 0) {
          setFormData((current) => ({ ...current, roomId: current.roomId || data[0].id }));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Không tải được danh sách phòng họp.');
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.id) === String(formData.roomId)),
    [formData.roomId, rooms],
  );
  const start = parseApiDateTime(formData.startTime);
  const end = parseApiDateTime(formData.endTime);
  const durationMinutes = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? 0
    : Math.max(0, Math.round((end - start) / 60000));
  const attendeeCount = Number(formData.attendeeCount || 0);
  const exceedsCapacity = Boolean(selectedRoom?.capacity && attendeeCount > selectedRoom.capacity);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const startTime = toApiLocalDateTime(formData.startTime);
      const endTime = toApiLocalDateTime(formData.endTime);
      if (parseApiDateTime(startTime) >= parseApiDateTime(endTime)) {
        throw new Error('Thời gian bắt đầu phải trước thời gian kết thúc.');
      }
      if (exceedsCapacity) {
        throw new Error(`Số người tham gia vượt sức chứa ${selectedRoom.capacity} người của phòng.`);
      }

      await bookingApi.createRoomBooking({
        roomId: formData.roomId,
        title: formData.title.trim(),
        startTime,
        endTime,
        attendeeCount,
        note: formData.note.trim(),
      });
      toast.success('Đăng ký phòng họp thành công!');
      navigate('/rooms');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Có lỗi xảy ra. Vui lòng kiểm tra lại!');
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => (
    <>
      <Button variant="secondary" type="button" onClick={() => navigate(-1)} disabled={loading} className="flex-1 lg:flex-none">
        Hủy bỏ
      </Button>
      <Button type="submit" disabled={loading || exceedsCapacity || rooms.length === 0} className="flex-1 lg:flex-none">
        {loading ? 'Đang gửi...' : 'Gửi đăng ký'}
      </Button>
    </>
  );

  return (
    <BookingFormShell
      title="Đặt phòng họp"
      description="Điền thông tin cuộc họp; hệ thống sẽ kiểm tra thời gian và xung đột khi gửi."
      onBack={() => navigate(-1)}
      onSubmit={handleSubmit}
      error={error}
      renderActions={renderActions}
      summary={(
        <>
          <BookingSummaryItem
            icon={Building2}
            label="Phòng họp"
            value={selectedRoom ? `${selectedRoom.name}${selectedRoom.location ? ` · ${selectedRoom.location}` : ''}` : 'Chưa chọn phòng'}
            accent="room"
          />
          <BookingSummaryItem
            icon={Users}
            label="Sức chứa"
            value={selectedRoom?.capacity ? `${selectedRoom.capacity} người` : 'Chưa có thông tin'}
            accent="room"
          />
          <BookingSummaryItem
            icon={CalendarDays}
            label="Ngày họp"
            value={formData.startTime ? formatViDate(formData.startTime) : 'Chưa chọn ngày'}
          />
          <BookingSummaryItem
            icon={Clock}
            label="Thời gian"
            value={formData.startTime && formData.endTime ? `${formatViTime(formData.startTime)} – ${formatViTime(formData.endTime)}` : 'Chưa chọn thời gian'}
          />
          <BookingSummaryItem
            icon={Timer}
            label="Thời lượng"
            value={formatDuration(durationMinutes)}
            accent="neutral"
          />
          <div className="mt-3 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-5">Lịch trống và xung đột sẽ được backend kiểm tra chính xác khi gửi đăng ký.</p>
          </div>
        </>
      )}
    >
      <Field label="Tiêu đề cuộc họp *">
        <input
          required
          maxLength={255}
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Ví dụ: Họp giao ban tuần"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Phòng họp *" icon={Building2}>
        <select required name="roomId" value={formData.roomId} onChange={handleChange} className={ICON_INPUT_CLASS}>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} · sức chứa {room.capacity} người
            </option>
          ))}
          {rooms.length === 0 && <option value="">Không có phòng khả dụng</option>}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Bắt đầu lúc *" icon={Clock}>
          <input required type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} className={ICON_INPUT_CLASS} />
        </Field>
        <Field label="Kết thúc lúc *" icon={Clock}>
          <input required type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} className={ICON_INPUT_CLASS} />
        </Field>
      </div>

      <Field
        label="Số người tham gia dự kiến *"
        icon={Users}
        hint={exceedsCapacity
          ? `Vượt sức chứa ${selectedRoom.capacity} người.`
          : selectedRoom?.capacity
            ? `Tối đa ${selectedRoom.capacity} người.`
            : 'Chọn phòng để xem sức chứa.'}
        error={exceedsCapacity}
      >
        <input
          required
          type="number"
          min="1"
          name="attendeeCount"
          value={formData.attendeeCount}
          onChange={handleChange}
          placeholder="Ví dụ: 12"
          className={ICON_INPUT_CLASS}
        />
      </Field>

      <Field label="Yêu cầu chuẩn bị / Ghi chú" icon={AlignLeft}>
        <textarea
          name="note"
          value={formData.note}
          onChange={handleChange}
          rows="5"
          maxLength={500}
          placeholder="Máy chiếu, bảng trắng, nước uống..."
          className={`${ICON_INPUT_CLASS} min-h-32 resize-y py-3`}
        />
        <span className="mt-1 block text-right text-xs text-[var(--cfc-muted)]">{formData.note.length}/500</span>
      </Field>
    </BookingFormShell>
  );
}

function Field({ label, icon: Icon, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--cfc-ink)]">{label}</span>
      <span className="relative block">
        {Icon && <Icon className={`pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 ${error ? 'text-red-500' : 'text-[var(--cfc-muted)]'}`} />}
        {children}
      </span>
      {hint && <span className={`mt-1.5 block text-xs ${error ? 'text-red-600' : 'text-[var(--cfc-muted)]'}`}>{hint}</span>}
    </label>
  );
}

function formatDuration(minutes) {
  if (!minutes) return 'Chưa xác định';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} phút`;
  if (!remaining) return `${hours} giờ`;
  return `${hours} giờ ${remaining} phút`;
}

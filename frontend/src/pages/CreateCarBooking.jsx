import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlignLeft,
  CalendarDays,
  Clock,
  Info,
  MapPin,
  Navigation,
  Timer,
  Truck,
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

export default function CreateCarBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedStart = location.state?.start ? new Date(location.state.start) : new Date();
  const preSelectedEnd = location.state?.end
    ? new Date(location.state.end)
    : new Date(preSelectedStart.getTime() + 60 * 60 * 1000);

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    vehicleId: '',
    departure: '',
    destination: '',
    startTime: toDateTimeLocalValue(preSelectedStart),
    endTime: toDateTimeLocalValue(preSelectedEnd),
    note: '',
  });

  useEffect(() => {
    let active = true;
    resourceApi.getCars()
      .then((data) => {
        if (!active) return;
        setCars(data || []);
        if (data?.length > 0) {
          setFormData((current) => ({ ...current, vehicleId: current.vehicleId || data[0].id }));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Không tải được danh sách xe công tác.');
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCar = useMemo(
    () => cars.find((car) => String(car.id) === String(formData.vehicleId)),
    [cars, formData.vehicleId],
  );
  const start = parseApiDateTime(formData.startTime);
  const end = parseApiDateTime(formData.endTime);
  const durationMinutes = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? 0
    : Math.max(0, Math.round((end - start) / 60000));

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

      await bookingApi.createCarBooking({
        vehicleId: formData.vehicleId,
        title: formData.title.trim(),
        departure: formData.departure.trim(),
        destination: formData.destination.trim(),
        startTime,
        endTime,
        note: formData.note.trim(),
      });
      toast.success('Đăng ký xe thành công!');
      navigate('/cars');
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
      <Button type="submit" disabled={loading || cars.length === 0} className="flex-1 lg:flex-none">
        {loading ? 'Đang gửi...' : 'Gửi đăng ký'}
      </Button>
    </>
  );

  return (
    <BookingFormShell
      title="Đặt xe công tác"
      description="Cung cấp hành trình và thời gian; hệ thống sẽ kiểm tra lịch xe khi gửi."
      onBack={() => navigate(-1)}
      onSubmit={handleSubmit}
      error={error}
      renderActions={renderActions}
      summary={(
        <>
          <BookingSummaryItem
            icon={Truck}
            label="Xe đề xuất"
            value={selectedCar ? `${selectedCar.vehicleType?.name || 'Xe'} · ${selectedCar.licensePlate}` : 'Chưa chọn xe'}
            accent="vehicle"
          />
          <BookingSummaryItem
            icon={Users}
            label="Số chỗ"
            value={selectedCar?.seatCount ? `${selectedCar.seatCount} chỗ` : 'Chưa có thông tin'}
            accent="vehicle"
          />
          <BookingSummaryItem
            icon={Navigation}
            label="Hành trình"
            value={formData.departure || formData.destination ? `${formData.departure || 'Điểm đón'} → ${formData.destination || 'Điểm đến'}` : 'Chưa nhập hành trình'}
            accent="vehicle"
          />
          <BookingSummaryItem
            icon={CalendarDays}
            label="Ngày xuất phát"
            value={formData.startTime ? formatViDate(formData.startTime) : 'Chưa chọn ngày'}
          />
          <BookingSummaryItem
            icon={Clock}
            label="Thời gian"
            value={formData.startTime && formData.endTime ? `${formatViTime(formData.startTime)} – ${formatViTime(formData.endTime)}` : 'Chưa chọn thời gian'}
          />
          <BookingSummaryItem icon={Timer} label="Thời lượng" value={formatDuration(durationMinutes)} accent="neutral" />
          <div className="mt-3 flex gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-5">Lịch xe và xung đột thời gian sẽ được backend kiểm tra chính xác khi gửi đăng ký.</p>
          </div>
        </>
      )}
    >
      <Field label="Mục đích chuyến đi *">
        <input
          required
          maxLength={255}
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Ví dụ: Công tác khách hàng Đồng Tháp"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Đề xuất xe *" icon={Truck}>
        <select required name="vehicleId" value={formData.vehicleId} onChange={handleChange} className={ICON_INPUT_CLASS}>
          {cars.map((car) => (
            <option key={car.id} value={car.id}>
              {car.vehicleType?.name || 'Xe'} · {car.licensePlate} · {car.seatCount} chỗ
            </option>
          ))}
          {cars.length === 0 && <option value="">Không có xe khả dụng</option>}
        </select>
      </Field>

      <div className="relative grid gap-5 sm:grid-cols-2">
        <span className="pointer-events-none absolute bottom-5 left-[calc(50%-1px)] top-5 hidden border-l border-dashed border-emerald-300 sm:block" />
        <Field label="Điểm đón *" icon={MapPin}>
          <input
            required
            maxLength={255}
            name="departure"
            value={formData.departure}
            onChange={handleChange}
            placeholder="Ví dụ: Trụ sở công ty"
            className={ICON_INPUT_CLASS}
          />
        </Field>
        <Field label="Điểm đến *" icon={Navigation}>
          <input
            required
            maxLength={255}
            name="destination"
            value={formData.destination}
            onChange={handleChange}
            placeholder="Nhập địa điểm đến"
            className={ICON_INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Thời gian xuất phát *" icon={Clock}>
          <input required type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} className={ICON_INPUT_CLASS} />
        </Field>
        <Field label="Dự kiến kết thúc *" icon={Clock}>
          <input required type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} className={ICON_INPUT_CLASS} />
        </Field>
      </div>

      <Field label="Mô tả chi tiết chuyến đi" icon={AlignLeft}>
        <textarea
          name="note"
          value={formData.note}
          onChange={handleChange}
          rows="5"
          maxLength={500}
          placeholder="Số người đi, yêu cầu hành lý hoặc thông tin cần lưu ý..."
          className={`${ICON_INPUT_CLASS} min-h-32 resize-y py-3`}
        />
        <span className="mt-1 block text-right text-xs text-[var(--cfc-muted)]">{formData.note.length}/500</span>
      </Field>
    </BookingFormShell>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--cfc-ink)]">{label}</span>
      <span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 text-[var(--cfc-muted)]" />}
        {children}
      </span>
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

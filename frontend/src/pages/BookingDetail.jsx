import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingApi } from '../api/bookingApi';
import { approvalApi } from '../api/approvalApi';
import { authApi } from '../api/authApi';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Surface } from '../components/ui/Surface';
import { BookingStatusBadge } from '../components/booking/BookingStatusBadge';
import { formatViDate, formatViDateTime, formatViTime } from '../utils/dateTime';

function getRoleLabel(role) {
  if (role === 'ADMIN') return 'Quản trị hệ thống';
  if (role === 'MANAGER') return 'Quản lý';
  return 'Nhân viên';
}

function getActionLabel(status) {
  if (status === 'APPROVED') return 'Đã phê duyệt';
  if (status === 'REJECTED') return 'Đã từ chối';
  if (status === 'CANCELLED') return 'Đã hủy';
  return 'Đang chờ';
}

function buildCarTitle(request) {
  if (request?.title) return request.title;
  const route = [request?.departure, request?.destination].filter(Boolean).join(' → ');
  return route || 'Chi tiết đặt xe';
}

function departmentName(user) {
  if (!user) return 'Chưa có phòng ban';
  if (typeof user.department === 'string') return user.department;
  return user.department?.name || user.departmentName || user.jobPosition || getRoleLabel(user.role);
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [approvalSteps, setApprovalSteps] = useState([]);
  const [showAllApprovalSteps, setShowAllApprovalSteps] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const currentUser = authApi.getUser();
  const isApprover = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const canReject = currentUser?.role === 'ADMIN';
  const canCancel = currentUser?.role === 'ADMIN';

  useEffect(() => {
    let active = true;
    const fetchDetail = async () => {
      setLoadError('');
      try {
        const [rooms, cars] = await Promise.all([
          bookingApi.getRoomBookings(),
          bookingApi.getCarBookings(),
        ]);
        const roomRequest = (rooms || []).find((item) => item.id === id || `REQ-00${item.id}` === id);
        const carRequest = roomRequest
          ? null
          : (cars || []).find((item) => item.id === id || `REQ-00${item.id}` === id);
        const selectedRequest = roomRequest || carRequest;
        const selectedType = roomRequest ? 'ROOM' : carRequest ? 'CAR' : '';

        if (!active) return;
        if (!selectedRequest) {
          setLoadError('Không tìm thấy yêu cầu đặt chỗ.');
          return;
        }

        setRequest(selectedRequest);
        setType(selectedType);
        try {
          const steps = selectedType === 'ROOM'
            ? await approvalApi.getRoomApprovalSteps(selectedRequest.id)
            : await approvalApi.getCarApprovalSteps(selectedRequest.id);
          if (active) setApprovalSteps(steps || []);
        } catch {
          if (active) setApprovalSteps([]);
        }
      } catch (requestError) {
        if (active) setLoadError(requestError.response?.data?.message || 'Không tải được chi tiết yêu cầu.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      active = false;
    };
  }, [id]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const payload = { reason: note.trim() || 'Đồng ý duyệt' };
      if (type === 'ROOM') await approvalApi.approveRoom(request.id, payload);
      else await approvalApi.approveCar(request.id, payload);
      toast.success('Đã phê duyệt thành công!');
      navigate('/admin/approvals');
    } catch (requestError) {
      toast.error(`Lỗi khi phê duyệt: ${requestError.response?.data?.message || requestError.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const payload = { reason: note.trim() || null };
      if (type === 'ROOM') await approvalApi.rejectRoom(request.id, payload);
      else await approvalApi.rejectCar(request.id, payload);
      toast.success('Đã từ chối thành công!');
      navigate('/admin/approvals');
    } catch (requestError) {
      toast.error(`Lỗi khi từ chối: ${requestError.response?.data?.message || requestError.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      if (type === 'ROOM') await bookingApi.cancelRoomBooking(request.id);
      else await bookingApi.cancelCarBooking(request.id);
      setRequest((current) => ({
        ...current,
        status: 'CANCELLED',
        cancelReason: null,
        cancelledBy: currentUser,
      }));
      setShowCancelForm(false);
      toast.success('Đã hủy booking thành công!');
    } catch (requestError) {
      toast.error(`Lỗi khi hủy booking: ${requestError.response?.data?.message || requestError.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const approvers = useMemo(() => approvalSteps.map((step) => ({
    id: step.id,
    fullName: step.approver?.fullName || 'Không rõ người duyệt',
    avatarUrl: step.approver?.avatarUrl,
    role: step.approver?.role,
    department: step.approver?.departmentName || step.approver?.jobPosition || getRoleLabel(step.approver?.role),
    status: step.status,
  })), [approvalSteps]);

  if (loading) {
    return <div className="flex min-h-80 items-center justify-center text-sm text-[var(--cfc-muted)]">Đang tải hồ sơ booking...</div>;
  }
  if (!request) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <p className="text-sm font-medium text-red-600">{loadError || 'Không tìm thấy yêu cầu!'}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>Quay lại</Button>
      </div>
    );
  }

  const resourceName = type === 'ROOM'
    ? request.room?.name
    : request.vehicle
      ? `${request.vehicle.vehicleType?.name || 'Xe'} · ${request.vehicle.licensePlate}`
      : 'Chưa xếp xe';
  const displayTitle = type === 'ROOM' ? (request.title || 'Chi tiết đặt phòng') : buildCarTitle(request);
  const visibleApprovers = showAllApprovalSteps ? approvers : approvers.slice(0, 2);

  return (
    <div className="min-h-full bg-[var(--cfc-canvas)] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto max-w-[1240px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--cfc-cobalt)] hover:text-[var(--cfc-cobalt-dark)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>

        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cfc-emerald-dark)]">
              Hồ sơ yêu cầu · {type === 'ROOM' ? 'Phòng họp' : 'Xe công tác'}
            </p>
            <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight text-[var(--cfc-ink)] sm:text-3xl">
              {displayTitle}
            </h1>
          </div>
          <BookingStatusBadge status={request.status} className="self-start sm:self-auto" />
        </header>

        {loadError && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="order-2 space-y-5 lg:order-1">
            <Surface className="overflow-hidden">
              <SectionHeader title="Thông tin đặt chỗ" />
              <div className="divide-y divide-[var(--cfc-border)] px-5 sm:px-6">
                <DetailRow icon={FileText} label="Tiêu đề" value={displayTitle} />
                <DetailRow
                  icon={User}
                  label="Người yêu cầu"
                  value={request.requester?.fullName || 'Không rõ'}
                  secondary={departmentName(request.requester)}
                />
                <DetailRow
                  icon={type === 'ROOM' ? Building2 : Car}
                  label={type === 'ROOM' ? 'Phòng họp' : 'Xe công tác'}
                  value={resourceName || 'Chưa xác định'}
                  secondary={type === 'ROOM' ? request.room?.location : undefined}
                />
                <DetailRow
                  icon={CalendarDays}
                  label="Thời gian"
                  value={`${formatViDate(request.startTime)} · ${formatViTime(request.startTime)} – ${formatViTime(request.endTime)}`}
                />
                {type === 'ROOM' ? (
                  <DetailRow icon={Users} label="Số người dự kiến" value={`${request.attendeeCount || 0} người`} />
                ) : (
                  <DetailRow
                    icon={MapPin}
                    label="Hành trình"
                    value={`${request.departure || 'Chưa có điểm đón'} → ${request.destination || 'Chưa có điểm đến'}`}
                  />
                )}
                <DetailRow icon={FileText} label="Nội dung / Ghi chú" value={request.note || 'Không có ghi chú'} multiline />
              </div>
            </Surface>

            <Surface className="overflow-hidden">
              <SectionHeader title="Lịch sử xử lý" description="Các mốc của yêu cầu được lưu theo thứ tự thời gian." />
              <div className="px-5 py-5 sm:px-6">
                <ApprovalTimeline request={request} steps={approvalSteps} />
              </div>
            </Surface>
          </main>

          <aside className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-5">
            <Surface className="overflow-hidden">
              <SectionHeader title={request.status === 'PENDING' && isApprover ? 'Xử lý yêu cầu' : 'Trạng thái yêu cầu'} />
              <div className="p-5">
                {request.status === 'PENDING' && isApprover ? (
                  <>
                    <label className="block text-sm font-semibold text-[var(--cfc-ink)]" htmlFor="approval-note">
                      Ghi chú <span className="font-normal text-[var(--cfc-muted)]">(không bắt buộc)</span>
                    </label>
                    <textarea
                      id="approval-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={500}
                      rows="5"
                      placeholder="Nhập ghi chú nếu cần..."
                      className="mt-2 min-h-28 w-full resize-y rounded-lg border border-[var(--cfc-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-right text-xs text-[var(--cfc-muted)]">{note.length}/500</p>
                    <div className="mt-4 grid gap-2">
                      <Button variant="success" disabled={processing} onClick={handleApprove}>
                        <CheckCircle2 className="h-4 w-4" />
                        {processing ? 'Đang xử lý...' : 'Phê duyệt'}
                      </Button>
                      {canReject && (
                        <Button variant="outline" disabled={processing} onClick={handleReject} className="border-red-300 text-red-600 hover:bg-red-50">
                          <XCircle className="h-4 w-4" />
                          Từ chối
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <StatusSummary request={request} />
                )}

                {request.status === 'APPROVED' && canCancel && !showCancelForm && (
                  <Button variant="danger" className="mt-4 w-full" onClick={() => setShowCancelForm(true)}>
                    <Ban className="h-4 w-4" />
                    Hủy booking
                  </Button>
                )}
                {request.status === 'APPROVED' && canCancel && showCancelForm && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="font-semibold text-red-800">Bạn có chắc muốn hủy booking này?</p>
                    <p className="mt-1 text-sm leading-5 text-red-700">
                      Lịch tài nguyên sẽ được giải phóng và người đặt nhận thông báo.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button variant="danger" size="sm" disabled={processing} onClick={handleCancel}>
                        {processing ? 'Đang hủy...' : 'Xác nhận hủy'}
                      </Button>
                      <Button variant="secondary" size="sm" disabled={processing} onClick={() => setShowCancelForm(false)}>
                        Giữ booking
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Surface>

            <Surface className="overflow-hidden">
              <SectionHeader title="Người xử lý" />
              <div className="space-y-3 p-5">
                {visibleApprovers.map((approver) => (
                  <div key={approver.id} className="flex items-center gap-3 rounded-lg border border-[var(--cfc-border)] p-3">
                    <Avatar src={approver.avatarUrl} name={approver.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--cfc-ink)]">{approver.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--cfc-muted)]">{approver.department}</p>
                    </div>
                    {approver.status === 'APPROVED'
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
                  </div>
                ))}
                {approvalSteps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--cfc-border)] p-4 text-sm text-[var(--cfc-muted)]">
                    {request.status === 'PENDING' ? 'Yêu cầu chưa được xử lý.' : 'Dữ liệu cũ chưa có lịch sử người xử lý.'}
                  </div>
                )}
                {approvers.length > 2 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllApprovalSteps((current) => !current)}>
                    {showAllApprovalSteps ? 'Thu gọn' : `Xem thêm ${approvers.length - 2} lần xử lý`}
                  </Button>
                )}
              </div>
            </Surface>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div className="border-b border-[var(--cfc-border)] px-5 py-4 sm:px-6">
      <h2 className="text-base font-bold text-[var(--cfc-ink)]">{title}</h2>
      {description && <p className="mt-1 text-sm text-[var(--cfc-muted)]">{description}</p>}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, secondary, multiline = false }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--cfc-muted)]">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        {label}
      </div>
      <div>
        <p className={`text-sm font-medium text-[var(--cfc-ink)] ${multiline ? 'whitespace-pre-wrap leading-6' : ''}`}>{value}</p>
        {secondary && <p className="mt-1 text-xs text-[var(--cfc-muted)]">{secondary}</p>}
      </div>
    </div>
  );
}

function ApprovalTimeline({ request, steps }) {
  const chronologicalSteps = [...steps].reverse();
  return (
    <ol className="relative ml-2 border-l border-[var(--cfc-border)]">
      <TimelineItem
        icon={FileText}
        title="Yêu cầu được tạo"
        description={`${request.requester?.fullName || 'Người dùng'} đã gửi yêu cầu đặt chỗ.`}
        time={request.createdAt ? formatViDateTime(request.createdAt) : undefined}
        tone="info"
      />
      {chronologicalSteps.map((step) => (
        <TimelineItem
          key={step.id}
          icon={step.status === 'APPROVED' ? CheckCircle2 : XCircle}
          title={getActionLabel(step.status)}
          description={`${step.approver?.fullName || 'Người xử lý'}${step.reason ? ` · ${step.reason}` : ''}`}
          time={step.actedAt ? formatViDateTime(step.actedAt) : undefined}
          tone={step.status === 'APPROVED' ? 'success' : 'danger'}
        />
      ))}
      {request.status === 'PENDING' && (
        <TimelineItem
          icon={Clock}
          title="Đang chờ xử lý"
          description="Yêu cầu đang chờ ADMIN hoặc MANAGER phê duyệt."
          tone="pending"
        />
      )}
      {request.status === 'CANCELLED' && (
        <TimelineItem
          icon={Ban}
          title="Booking đã được hủy"
          description={request.cancelledBy?.fullName ? `Người hủy: ${request.cancelledBy.fullName}` : 'Lịch tài nguyên đã được giải phóng.'}
          tone="neutral"
        />
      )}
    </ol>
  );
}

function TimelineItem({ icon: Icon, title, description, time, tone }) {
  const tones = {
    info: 'border-blue-500 bg-blue-50 text-blue-700',
    success: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    danger: 'border-red-500 bg-red-50 text-red-700',
    pending: 'border-amber-500 bg-amber-50 text-amber-700',
    neutral: 'border-slate-400 bg-slate-100 text-slate-600',
  };
  return (
    <li className="relative pb-6 pl-7 last:pb-0">
      <span className={`absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full border ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--cfc-ink)]">{title}</p>
          <p className="mt-1 text-sm leading-5 text-[var(--cfc-muted)]">{description}</p>
        </div>
        {time && <time className="mt-1 block shrink-0 text-xs text-[var(--cfc-muted)] sm:mt-0">{time}</time>}
      </div>
    </li>
  );
}

function StatusSummary({ request }) {
  return (
    <div className="rounded-lg border border-[var(--cfc-border)] bg-[var(--cfc-surface-muted)] p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--cfc-emerald-dark)]" />
        <p className="text-sm font-semibold text-[var(--cfc-ink)]">{getActionLabel(request.status)}</p>
      </div>
      <p className="mt-2 text-sm leading-5 text-[var(--cfc-muted)]">
        {request.status === 'APPROVED' && 'Tài nguyên đã được giữ cho khung thời gian này.'}
        {request.status === 'REJECTED' && 'Yêu cầu đã bị từ chối và không giữ tài nguyên.'}
        {request.status === 'CANCELLED' && 'Booking đã hủy; lịch tài nguyên đã được giải phóng.'}
        {request.status === 'PENDING' && 'Bạn có thể theo dõi trạng thái tại trang này.'}
      </p>
    </div>
  );
}

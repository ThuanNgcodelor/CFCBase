import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Car, ClipboardCheck, Eye, Search } from 'lucide-react';
import { bookingApi } from '../api/bookingApi';
import { formatViDate, formatViTime, parseApiDateTime } from '../utils/dateTime';
import { BookingEmptyState } from '../components/booking/BookingEmptyState';
import { BookingPageHeader } from '../components/booking/BookingPageHeader';
import { BookingStatusBadge } from '../components/booking/BookingStatusBadge';
import { ApprovalPreviewDrawer } from '../components/admin/ApprovalPreviewDrawer';
import AdminApprovalHistory from '../components/admin/AdminApprovalHistory';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Surface } from '../components/ui/Surface';

function buildCarPurpose(booking) {
  if (booking.title) return booking.title;
  const route = [booking.departure, booking.destination].filter(Boolean).join(' → ');
  return route || 'Đặt xe công tác';
}

function getDepartment(user) {
  if (!user) return 'Nhân viên';
  if (typeof user.department === 'string') return user.department;
  return user.department?.name || user.departmentName || user.jobPosition || 'Nhân viên';
}

export default function AdminApprovals() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchPending = async () => {
      setLoading(true);
      setError('');
      try {
        const [rooms, cars] = await Promise.all([
          bookingApi.getRoomBookings(),
          bookingApi.getCarBookings(),
        ]);
        if (!active) return;

        const mappedRooms = (rooms || [])
          .filter((room) => room.status === 'PENDING')
          .map((room) => ({
            id: room.id,
            type: 'ROOM',
            resourceName: room.room?.name || 'Chưa xác định phòng',
            purpose: room.title || 'Đặt phòng họp',
            startTime: room.startTime,
            endTime: room.endTime,
            booker: {
              fullName: room.requester?.fullName || 'Không rõ người đặt',
              department: getDepartment(room.requester),
              avatar: room.requester?.avatarUrl,
            },
            raw: room,
          }));

        const mappedCars = (cars || [])
          .filter((car) => car.status === 'PENDING')
          .map((car) => ({
            id: car.id,
            type: 'CAR',
            resourceName: car.vehicle
              ? `${car.vehicle.vehicleType?.name || 'Xe'} · ${car.vehicle.licensePlate}`
              : 'Chưa xếp xe',
            purpose: buildCarPurpose(car),
            startTime: car.startTime,
            endTime: car.endTime,
            booker: {
              fullName: car.requester?.fullName || 'Không rõ người đặt',
              department: getDepartment(car.requester),
              avatar: car.requester?.avatarUrl,
            },
            raw: car,
          }));

        setPendingRequests(
          [...mappedRooms, ...mappedCars].sort(
            (left, right) => parseApiDateTime(left.startTime) - parseApiDateTime(right.startTime),
          ),
        );
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Không tải được danh sách yêu cầu chờ duyệt.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPending();
    return () => {
      active = false;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    return pendingRequests.filter((request) => {
      const matchesType = typeFilter === 'ALL' || request.type === typeFilter;
      const haystack = `${request.purpose} ${request.resourceName} ${request.booker.fullName} ${request.booker.department}`
        .toLocaleLowerCase('vi');
      return matchesType && (!normalizedKeyword || haystack.includes(normalizedKeyword));
    });
  }, [keyword, pendingRequests, typeFilter]);

  const openDetail = useCallback((request) => {
    navigate(`/admin/approvals/${request.id}`);
  }, [navigate]);
  const closePreview = useCallback(() => setSelectedRequest(null), []);

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col">
      <BookingPageHeader
        eyebrow="Quản trị hệ thống"
        title="Duyệt đặt chỗ"
        description="Kiểm tra yêu cầu phòng họp và xe công tác đang chờ xử lý."
        className="mb-5"
      />

      <div className="mb-4 flex border-b border-[var(--cfc-border)]">
        <TabButton active={activeTab === 'PENDING'} onClick={() => setActiveTab('PENDING')}>
          Chờ duyệt {!loading && <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{pendingRequests.length}</span>}
        </TabButton>
        <TabButton active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')}>
          Lịch sử xử lý
        </TabButton>
      </div>

      {activeTab === 'PENDING' ? (
        <>
          <Surface className="mb-4 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px_auto]">
              <label className="relative">
                <span className="sr-only">Tìm yêu cầu</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cfc-muted)]" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Tìm tiêu đề, tài nguyên hoặc người đặt..."
                  className="h-11 w-full rounded-lg border border-[var(--cfc-border)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-11 rounded-lg border border-[var(--cfc-border)] bg-white px-3 text-sm text-[var(--cfc-ink)] outline-none focus:border-[var(--cfc-cobalt)] focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">Tất cả loại</option>
                <option value="ROOM">Phòng họp</option>
                <option value="CAR">Xe công tác</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                disabled={!keyword && typeFilter === 'ALL'}
                onClick={() => {
                  setKeyword('');
                  setTypeFilter('ALL');
                }}
              >
                Xóa lọc
              </Button>
            </div>
          </Surface>

          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Surface className="overflow-hidden">
            <PendingDesktop
              loading={loading}
              requests={filteredRequests}
              onPreview={setSelectedRequest}
              onDetail={openDetail}
            />
            <PendingMobile
              loading={loading}
              requests={filteredRequests}
              onPreview={setSelectedRequest}
            />
            {!loading && filteredRequests.length === 0 && (
              <BookingEmptyState
                icon={ClipboardCheck}
                title={pendingRequests.length === 0 ? 'Không có yêu cầu chờ duyệt' : 'Không có yêu cầu phù hợp'}
                description={pendingRequests.length === 0 ? 'Các yêu cầu mới sẽ xuất hiện tại đây.' : 'Hãy thử đổi từ khóa hoặc loại tài nguyên.'}
              />
            )}
          </Surface>
        </>
      ) : (
        <AdminApprovalHistory />
      )}

      <ApprovalPreviewDrawer
        request={selectedRequest}
        onClose={closePreview}
        onOpenDetail={openDetail}
      />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-12 px-4 text-sm font-semibold transition-colors ${
        active
          ? 'text-[var(--cfc-emerald-dark)] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[var(--cfc-emerald)]'
          : 'text-[var(--cfc-muted)] hover:text-[var(--cfc-ink)]'
      }`}
    >
      {children}
    </button>
  );
}

function PendingDesktop({ loading, requests, onPreview, onDetail }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full">
        <thead className="bg-[var(--cfc-surface-muted)] text-left">
          <tr className="cfc-data-label">
            <th className="px-5 py-3">Yêu cầu</th>
            <th className="px-5 py-3">Loại / Tài nguyên</th>
            <th className="px-5 py-3">Người đặt</th>
            <th className="px-5 py-3">Thời gian</th>
            <th className="px-5 py-3">Trạng thái</th>
            <th className="px-5 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--cfc-border)]">
          {loading && (
            <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-[var(--cfc-muted)]">Đang tải yêu cầu...</td></tr>
          )}
          {!loading && requests.map((request) => (
            <tr
              key={`${request.type}-${request.id}`}
              onClick={() => onPreview(request)}
              className="cursor-pointer transition-colors hover:bg-emerald-50/35"
            >
              <td className="max-w-[280px] px-5 py-4">
                <p className="truncate text-sm font-semibold text-[var(--cfc-ink)]">{request.purpose}</p>
                <p className="mt-1 text-xs text-[var(--cfc-muted)]">Mã: {request.id}</p>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <ResourceIcon type={request.type} />
                  <div>
                    <p className="text-sm font-medium text-[var(--cfc-ink)]">{request.type === 'ROOM' ? 'Phòng họp' : 'Xe công tác'}</p>
                    <p className="mt-1 text-xs text-[var(--cfc-muted)]">{request.resourceName}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src={request.booker.avatar} name={request.booker.fullName} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-[var(--cfc-ink)]">{request.booker.fullName}</p>
                    <p className="mt-1 text-xs text-[var(--cfc-muted)]">{request.booker.department}</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-4">
                <p className="text-sm font-medium text-[var(--cfc-ink)]">{formatViDate(request.startTime)}</p>
                <p className="mt-1 text-xs text-[var(--cfc-muted)]">{formatViTime(request.startTime)} – {formatViTime(request.endTime)}</p>
              </td>
              <td className="px-5 py-4"><BookingStatusBadge status="PENDING" /></td>
              <td className="px-5 py-4 text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Xem nhanh ${request.purpose}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreview(request);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDetail(request);
                  }}
                >
                  Xử lý
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingMobile({ loading, requests, onPreview }) {
  if (loading || requests.length === 0) return null;
  return (
    <div className="divide-y divide-[var(--cfc-border)] md:hidden">
      {requests.map((request) => (
        <button
          key={`${request.type}-${request.id}`}
          type="button"
          onClick={() => onPreview(request)}
          className="w-full px-4 py-4 text-left hover:bg-slate-50"
        >
          <div className="flex items-start gap-3">
            <ResourceIcon type={request.type} large />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-semibold text-[var(--cfc-ink)]">{request.purpose}</p>
                <BookingStatusBadge status="PENDING" />
              </div>
              <p className="mt-1 text-xs text-[var(--cfc-muted)]">{request.resourceName}</p>
              <div className="mt-3 flex items-center gap-2">
                <Avatar src={request.booker.avatar} name={request.booker.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--cfc-ink)]">{request.booker.fullName}</p>
                  <p className="truncate text-[11px] text-[var(--cfc-muted)]">{request.booker.department}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-[var(--cfc-ink)]">
                {formatViDate(request.startTime)} · {formatViTime(request.startTime)} – {formatViTime(request.endTime)}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ResourceIcon({ type, large = false }) {
  const isRoom = type === 'ROOM';
  const Icon = isRoom ? Building2 : Car;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${
      large ? 'h-11 w-11' : 'h-9 w-9'
    } ${isRoom ? 'bg-blue-50 text-[var(--cfc-room)]' : 'bg-teal-50 text-[var(--cfc-vehicle)]'}`}>
      <Icon className={large ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  );
}

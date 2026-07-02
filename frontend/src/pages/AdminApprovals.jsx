import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Building2, Calendar, Car, Clock } from 'lucide-react';
import { bookingApi } from '../api/bookingApi';

export default function AdminApprovals() {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const [rooms, cars] = await Promise.all([
          bookingApi.getRoomBookings(),
          bookingApi.getCarBookings()
        ]);

        const mappedRooms = (rooms || []).filter(r => r.status === 'PENDING').map(r => ({
          id: r.id,
          type: 'ROOM',
          resourceName: r.room?.name,
          purpose: r.title,
          timeInfo: `${new Date(r.startTime).toLocaleString('vi-VN')} - ${new Date(r.endTime).toLocaleString('vi-VN')}`,
          booker: {
            fullName: r.requester?.fullName,
            department: r.requester?.department || 'Nhân viên',
            avatar: 'https://i.pravatar.cc/150?u=' + r.requester?.email,
          },
          raw: r
        }));

        const mappedCars = (cars || []).filter(c => c.status === 'PENDING').map(c => ({
          id: c.id,
          type: 'CAR',
          resourceName: c.vehicle ? `${c.vehicle.vehicleType?.name} - ${c.vehicle.licensePlate}` : 'Chưa xếp xe',
          purpose: c.title,
          timeInfo: `${new Date(c.startTime).toLocaleString('vi-VN')} - ${new Date(c.endTime).toLocaleString('vi-VN')}`,
          booker: {
            fullName: c.requester?.fullName,
            department: c.requester?.department || 'Nhân viên',
            avatar: 'https://i.pravatar.cc/150?u=' + c.requester?.email,
          },
          raw: c
        }));

        setPendingRequests([...mappedRooms, ...mappedCars]);
      } catch (e) {
        console.error("Lỗi lấy danh sách pending:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, []);

  return (
    <div className="w-full flex-1 flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Duyệt yêu cầu</h1>
        <p className="text-gray-500 mt-1">Quản lý và xét duyệt các yêu cầu sử dụng tài nguyên đang chờ xử lý.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mã YC</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Người yêu cầu</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tài nguyên</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Hành động</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">Đang tải...</td>
              </tr>
            ) : pendingRequests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {req.id.substring(0, 8).toUpperCase()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img className="h-8 w-8 rounded-full border border-gray-200" src={req.booker.avatar} alt="" />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{req.booker.fullName}</div>
                      <div className="text-xs text-gray-500">{req.booker.department}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 font-medium flex items-center gap-2">
                    {req.type === 'ROOM' ? <Building2 className="w-4 h-4 text-blue-500"/> : <Car className="w-4 h-4 text-green-500"/>}
                    {req.resourceName}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-[250px] mt-0.5">{req.purpose}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/50">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {req.timeInfo}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/approvals/${req.id}`)}>
                    Xem chi tiết
                  </Button>
                </td>
              </tr>
            ))}
            
            {!loading && pendingRequests.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  Không có yêu cầu nào đang chờ duyệt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

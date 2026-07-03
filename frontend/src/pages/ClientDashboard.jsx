import React, { useState, useEffect } from 'react';
import { DoorOpen, Car, CalendarClock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { dashboardApi } from '../api/dashboardApi';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const user = authApi.getUser();
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      dashboardApi.getClientStats(user.id)
        .then(data => setUpcoming(data.upcomingBookings || []))
        .catch(err => console.error("Error loading client stats:", err))
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  return (
    <div className="w-full flex-1">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Xin chào, {user?.fullName || 'bạn'}! </h1>
        <p className="text-gray-500 mt-1">Hôm nay bạn muốn làm gì ?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Quick Action: Đặt phòng */}
        <div
          onClick={() => navigate('/rooms/create')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-sm text-white cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-white/20 rounded-xl">
              <DoorOpen className="w-8 h-8" />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-xl font-semibold">Đặt phòng họp</h3>
            <p className="text-blue-100 text-sm mt-1">Tìm phòng trống và lên lịch ngay</p>
          </div>
        </div>

        {/* Quick Action: Đặt xe */}
        <div
          onClick={() => navigate('/cars/create')}
          className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-2xl shadow-sm text-white cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-white/20 rounded-xl">
              <Car className="w-8 h-8" />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-xl font-semibold">Đặt xe công tác</h3>
            <p className="text-teal-100 text-sm mt-1">Yêu cầu xe cho chuyến đi tiếp theo</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Lịch trình sắp tới của bạn</h2>
        </div>
        <div className={`flex flex-col ${upcoming.length > 0 ? 'gap-0' : 'items-center justify-center py-12 text-gray-500 bg-gray-50/50'}`}>
          {loading ? (
            <div className="py-8 text-center text-gray-400">Đang tải...</div>
          ) : upcoming.length > 0 ? (
            upcoming.map((act) => (
              <div key={act.id} className="p-6 border-b border-gray-50 hover:bg-gray-50/50 transition-colors flex items-center justify-between last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${act.type === 'ROOM' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'}`}>
                    {act.type === 'ROOM' ? <DoorOpen className="w-6 h-6" /> : <Car className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{act.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{act.subtitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${act.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        act.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {act.status === 'APPROVED' ? 'Đã duyệt' : act.status === 'PENDING' ? 'Chờ duyệt' : act.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800">
                    {new Date(act.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(act.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(act.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <>
              <CalendarClock className="w-12 h-12 text-gray-300 mb-4" />
              <p className="font-medium text-gray-600">Bạn chưa có lịch trình nào sắp tới.</p>
              <p className="text-sm mt-1">Các phòng/xe đã đặt sẽ hiển thị tại đây.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Users, DoorOpen, Car, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboardApi';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeRooms: 0, totalRooms: 0,
    activeCars: 0, totalCars: 0,
    pendingApprovals: 0,
    todayActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getAdminStats()
      .then(data => setStats(data))
      .catch(err => console.error("Error loading admin stats:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full flex-1">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tổng quan Quản trị</h1>
          <p className="text-gray-500 mt-1">Giám sát tài nguyên và xử lý yêu cầu đặt lịch.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Phòng đang trống</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {loading ? '-' : `${stats.activeRooms}/${stats.totalRooms}`}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Xe sẵn sàng</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {loading ? '-' : `${stats.activeCars}/${stats.totalCars}`}
            </p>
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/approvals')}
          className="bg-white p-6 rounded-xl border border-amber-100 shadow-sm flex items-start gap-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Yêu cầu chờ duyệt</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? '-' : stats.pendingApprovals}
              </p>
              {stats.pendingApprovals > 0 && (
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Cần xử lý</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Hoạt động trong ngày</h2>
          <button onClick={() => navigate('/rooms')} className="text-sm font-medium text-blue-600 hover:text-blue-700">Xem lịch chi tiết &rarr;</button>
        </div>
        <div className="flex flex-col gap-3">
          {loading ? (
             <div className="py-8 text-center text-gray-400">Đang tải...</div>
          ) : stats.todayActivities?.length > 0 ? (
            stats.todayActivities.map((act) => (
              <div key={act.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${act.type === 'ROOM' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'}`}>
                    {act.type === 'ROOM' ? <DoorOpen className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{act.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{act.subtitle} &bull; {act.requesterName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">
                    {new Date(act.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(act.endTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(act.startTime).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                 <Clock className="w-8 h-8 text-gray-300" />
              </div>
              <p>Chưa có lịch trình nào đang diễn ra trong hôm nay.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

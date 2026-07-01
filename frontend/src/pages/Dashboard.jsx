import React from 'react';
import { Users, DoorOpen, Car } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">Quản lý và theo dõi tình trạng phòng họp, xe nội bộ.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Card 1 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Phòng đang trống</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">4/5</p>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Xe sẵn sàng</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">2/3</p>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Yêu cầu chờ duyệt</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">7</p>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lịch trình hôm nay</h2>
        <div className="text-center py-12 text-gray-500">
          Chưa có lịch trình nào được xếp trong ngày hôm nay.
        </div>
      </div>
    </div>
  );
}

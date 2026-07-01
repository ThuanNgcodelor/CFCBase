import React, { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Building2, Calendar, Car, Clock, Mail, Phone, MapPin, User, CheckCircle, XCircle } from 'lucide-react';

// Fake Data for Pending Approvals
const pendingRequests = [
  {
    id: 'REQ-001',
    type: 'ROOM',
    resourceName: 'Phòng Hội đồng 1',
    purpose: 'Họp giao ban tuần ban Giám đốc',
    timeInfo: '14:00 - 16:00, Hôm nay',
    booker: {
      fullName: 'Nguyễn Văn A',
      email: 'a.nguyen@booking.base.vn',
      phone: '0901.234.567',
      department: 'Phòng Phát triển Kinh doanh',
      avatar: 'https://i.pravatar.cc/150?u=a.nguyen',
    }
  },
  {
    id: 'REQ-002',
    type: 'CAR',
    resourceName: 'Ford Transit 16 Chỗ (30G-987.65)',
    purpose: 'Đưa đón đoàn đối tác từ Sân bay Nội Bài',
    timeInfo: '08:00 - 11:30, Ngày mai',
    booker: {
      fullName: 'Trần Thị B',
      email: 'b.tran@booking.base.vn',
      phone: '0988.765.432',
      department: 'Phòng Hành chính Nhân sự',
      avatar: 'https://i.pravatar.cc/150?u=b.tran',
    }
  }
];

export default function AdminApprovals() {
  const [selectedReq, setSelectedReq] = useState(null);

  const handleApprove = () => {
    alert(`Đã DUYỆT yêu cầu ${selectedReq.id}`);
    setSelectedReq(null);
  };

  const handleReject = () => {
    const reason = prompt('Nhập lý do từ chối:');
    if (reason !== null) {
      alert(`Đã TỪ CHỐI yêu cầu ${selectedReq.id} với lý do: ${reason}`);
      setSelectedReq(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Duyệt yêu cầu</h1>
        <p className="text-gray-500 mt-1">Quản lý và xét duyệt các yêu cầu sử dụng tài nguyên đang chờ xử lý.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
            {pendingRequests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {req.id}
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
                  <Button size="sm" variant="secondary" onClick={() => setSelectedReq(req)}>
                    Xem chi tiết
                  </Button>
                </td>
              </tr>
            ))}
            
            {pendingRequests.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  Không có yêu cầu nào đang chờ duyệt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Chi tiết Yêu cầu và Thông tin Người đặt */}
      <Modal
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title={`Chi tiết yêu cầu ${selectedReq?.id}`}
      >
        {selectedReq && (
          <div className="space-y-6">
            
            {/* User Profile Card */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start gap-4">
              <img src={selectedReq.booker.avatar} alt="" className="w-16 h-16 rounded-full border-2 border-white shadow-sm" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedReq.booker.fullName}</h3>
                <p className="text-sm text-blue-600 font-medium mb-2">{selectedReq.booker.department}</p>
                <div className="grid grid-cols-1 gap-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {selectedReq.booker.email}</div>
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {selectedReq.booker.phone}</div>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Thông tin đặt tài nguyên</h4>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 text-sm">
                <div className="sm:col-span-1">
                  <dt className="text-gray-500 font-medium">Tài nguyên</dt>
                  <dd className="mt-1 text-gray-900 font-semibold">{selectedReq.resourceName}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-gray-500 font-medium">Thời gian</dt>
                  <dd className="mt-1 text-gray-900 font-semibold">{selectedReq.timeInfo}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">Mục đích sử dụng</dt>
                  <dd className="mt-1 text-gray-900 p-3 bg-gray-50 rounded-md border border-gray-100">{selectedReq.purpose}</dd>
                </div>
              </dl>
            </div>

            {/* Actions */}
            <div className="pt-4 mt-6 flex justify-end gap-3 border-t border-gray-100">
              <Button variant="danger" type="button" onClick={handleReject} className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> Từ chối
              </Button>
              <Button type="button" onClick={handleApprove} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white">
                <CheckCircle className="w-4 h-4" /> Duyệt yêu cầu
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, User, Clock, FileText, XCircle, Send } from 'lucide-react';
import { bookingApi } from '../api/bookingApi';
import { approvalApi } from '../api/approvalApi';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(''); // 'ROOM' or 'CAR'
  const [note, setNote] = useState('');
  const [approvers, setApprovers] = useState([]);
  const [showAllApprovers, setShowAllApprovers] = useState(false);

  const currentUser = authApi.getUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isApprover = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [rooms, cars, approversList] = await Promise.all([
          bookingApi.getRoomBookings(),
          bookingApi.getCarBookings(),
          userApi.getApprovers()
        ]);
        setApprovers(approversList || []);

        const roomReq = (rooms || []).find(r => r.id === id || `REQ-00${r.id}` === id);
        if (roomReq) {
          setRequest(roomReq);
          setType('ROOM');
        } else {
          const carReq = (cars || []).find(c => c.id === id || `REQ-00${c.id}` === id);
          if (carReq) {
            setRequest(carReq);
            setType('CAR');
          }
        }
      } catch (e) {
        console.error("Lỗi lấy chi tiết:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleApprove = async () => {
    try {
      const payload = { approverId: currentUser.id, note: note || 'Đồng ý duyệt' };
      if (type === 'ROOM') {
        await approvalApi.approveRoom(request.id, payload);
      } else {
        await approvalApi.approveCar(request.id, payload);
      }
      toast.success('Đã phê duyệt thành công!');
      navigate('/admin/approvals');
    } catch (e) {
      toast.error('Lỗi khi phê duyệt: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleReject = async () => {
    if (!note) {
      toast.error("Vui lòng nhập lý do từ chối vào ô bình luận!");
      return;
    }
    try {
      const payload = { approverId: currentUser.id, note: note };
      if (type === 'ROOM') {
        await approvalApi.rejectRoom(request.id, payload);
      } else {
        await approvalApi.rejectCar(request.id, payload);
      }
      toast.success('Đã từ chối thành công!');
      navigate('/admin/approvals');
    } catch (e) {
      toast.error('Lỗi khi từ chối: ' + (e.response?.data?.message || e.message));
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (!request) return <div className="p-8 text-center text-red-500">Không tìm thấy yêu cầu!</div>;

  const resourceName = type === 'ROOM' ? request.room?.name : request.vehicle ? `${request.vehicle.vehicleType?.name} - ${request.vehicle.licensePlate}` : 'Chưa xếp xe';

  return (
    <div className="flex flex-col min-h-full shrink-0 bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a56d6] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm uppercase tracking-wide">
            {request.title}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start w-full">
        {/* Cột trái (Thông tin chính) */}
        <div className="flex-1 w-full bg-white md:border-r border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900 uppercase mb-2">
              {request.title}
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Trạng thái:</span>
              <span className={`font-semibold ${request.status === 'APPROVED' ? 'text-green-600' : request.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'}`}>
                {request.status}
              </span>
            </div>

            <h3 className="mt-8 mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Thông tin</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Người tạo</p>
                  <p className="text-sm font-medium text-gray-900">{request.requester?.fullName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bắt đầu lúc</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(request.startTime).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:col-start-2">
                <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Kết thúc lúc</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(request.endTime).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:col-span-2">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mô tả / Ghi chú</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{request.note || 'Không có ghi chú'}</p>
                  {type === 'CAR' && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p><strong>Điểm đi:</strong> {request.departure}</p>
                      <p><strong>Điểm đến:</strong> {request.destination}</p>
                    </div>
                  )}
                  {type === 'ROOM' && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p><strong>Số người tham gia:</strong> {request.attendeeCount}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Log / Feedback */}
          <div className="bg-gray-50 p-6 flex-1 flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Lý do duyệt / từ chối</h3>

            {request.status === 'PENDING' && isApprover && (
              <>
                <div className="mt-2 mb-4 flex items-center gap-2 border border-gray-200 bg-white rounded-full px-4 py-2 shadow-sm">
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nhập lý do duyệt hoặc từ chối..."
                    className="flex-1 outline-none text-sm bg-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white">Phê duyệt</Button>
                  <Button onClick={handleReject} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">Từ chối</Button>
                </div>
              </>
            )}

            {/* Chỗ này có thể mở rộng log step sau này */}
          </div>
        </div>

        {/* Cột phải (Tài nguyên) */}
        <div className="w-full md:w-80 bg-gray-50 flex flex-col shrink-0 border-t md:border-t-0 md:border-l border-gray-100 min-h-full">
          {/* Người Duyệt */}
          <div className="p-4 border-b border-gray-100 bg-[#fbfbfb]">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Người Duyệt</h3>
            <div className="space-y-3">
              {(showAllApprovers ? approvers : approvers.slice(0, 2)).map(approver => (
                <div key={approver.id} className="flex items-start justify-between bg-white p-3 border border-gray-100 rounded shadow-sm">
                  <div className="flex items-start gap-3">
                    {approver.avatarUrl ? (
                      <img src={approver.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${approver.role === 'ADMIN' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {approver.fullName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{approver.fullName}</p>
                      <p className="text-[11px] text-gray-500 leading-tight">
                        {approver.department?.name || (approver.role === 'ADMIN' ? 'Quản trị hệ thống' : 'Quản lý')}
                      </p>
                    </div>
                  </div>
                  {request.status === 'APPROVED' ? (
                    <div className="w-3 h-3 rounded-full bg-green-500 shrink-0 mt-2 border-2 border-white shadow-sm" title="Đã duyệt"></div>
                  ) : request.status === 'REJECTED' ? (
                    <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-2 border-2 border-white shadow-sm" title="Đã từ chối"></div>
                  ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-green-400 shrink-0 mt-2" title="Chờ duyệt"></div>
                  )}
                </div>
              ))}
              
              {approvers.length > 2 && (
                <button 
                  onClick={() => setShowAllApprovers(!showAllApprovers)}
                  className="w-full text-xs text-blue-600 font-medium py-1.5 hover:bg-blue-50 rounded transition-colors text-center mt-2 border border-dashed border-blue-200"
                >
                  {showAllApprovers ? 'Thu gọn' : `Xem thêm ${approvers.length - 2} người`}
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Thông tin Tài nguyên</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">Tên {type === 'ROOM' ? 'Phòng' : 'Xe'}</p>
                <p className="text-sm font-medium text-gray-900">{resourceName}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">Người quản lý</p>
                {approvers.length > 0 && (
                <div className="flex items-center gap-2">
                  {approvers[0].avatarUrl ? (
                    <img src={approvers[0].avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs text-green-600 font-bold">
                      {approvers[0].fullName?.charAt(0)}
                    </div>
                  )}
                  <p className="text-sm text-gray-900">{approvers[0].fullName}</p>
                </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

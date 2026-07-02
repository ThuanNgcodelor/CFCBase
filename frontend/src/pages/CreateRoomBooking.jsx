import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Building2, AlignLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { resourceApi } from '../api/resourceApi';
import { bookingApi } from '../api/bookingApi';
import { authApi } from '../api/authApi';
import toast from 'react-hot-toast';

export default function CreateRoomBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedStart = location.state?.start ? new Date(location.state.start) : new Date();

  const formatDateTime = (date) => {
    const pad = (n) => (n < 10 ? '0' + n : n);
    return date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + 'T' +
      pad(date.getHours()) + ':' +
      pad(date.getMinutes());
  };

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    roomId: '',
    startTime: formatDateTime(preSelectedStart),
    endTime: formatDateTime(new Date(preSelectedStart.getTime() + 60 * 60 * 1000)), // default 1 hr later
    attendeeCount: '',
    note: ''
  });

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await resourceApi.getRooms();
        setRooms(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, roomId: data[0].id }));
        }
      } catch (err) {
        console.error("Lỗi tải danh sách phòng:", err);
      }
    };
    fetchRooms();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const user = authApi.getUser();
      const payload = {
        requesterId: user?.id,
        roomId: formData.roomId,
        title: formData.title,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        attendeeCount: formData.attendeeCount ? parseInt(formData.attendeeCount) : 0,
        note: formData.note
      };
      
      await bookingApi.createRoomBooking(payload);
      toast.success('Đăng ký phòng họp thành công!');
      navigate('/rooms');
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng kiểm tra lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Đăng kí Phòng họp</h1>
          <p className="text-sm text-gray-500 mt-1">Vui lòng điền thông tin chi tiết cuộc họp.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-3 rounded bg-red-50 text-red-600 border border-red-100 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Tên cuộc họp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề cuộc họp <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="VD: Họp giao ban tuần, Báo cáo dự án..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Chọn phòng */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phòng họp <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
              <select 
                name="roomId"
                value={formData.roomId}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none bg-white"
                required
              >
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name} (Sức chứa {room.capacity} người)
                  </option>
                ))}
                {rooms.length === 0 && <option value="">Đang tải hoặc không có phòng...</option>}
              </select>
            </div>
          </div>

          {/* Thời gian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bắt đầu lúc <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="datetime-local" 
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kết thúc lúc <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <input 
                  type="datetime-local" 
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Số người tham gia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số người tham gia dự kiến</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="w-5 h-5 text-gray-400" />
              </div>
              <input 
                type="number" 
                name="attendeeCount"
                value={formData.attendeeCount}
                onChange={handleChange}
                min="1"
                placeholder="VD: 10"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Yêu cầu chuẩn bị (Ghi chú)</label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <AlignLeft className="w-5 h-5 text-gray-400" />
              </div>
              <textarea 
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows="4"
                placeholder="VD: Chuẩn bị máy chiếu, 10 chai nước suối, teabreak lúc 9h..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              ></textarea>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => navigate(-1)} disabled={loading}>Hủy bỏ</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi đăng kí'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

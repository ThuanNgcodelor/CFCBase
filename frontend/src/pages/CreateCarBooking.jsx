import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Truck, AlignLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { resourceApi } from '../api/resourceApi';
import { bookingApi } from '../api/bookingApi';
import { authApi } from '../api/authApi';
import toast from 'react-hot-toast';

export default function CreateCarBooking() {
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

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    vehicleId: '',
    departure: '',
    destination: '',
    startTime: formatDateTime(preSelectedStart),
    endTime: formatDateTime(new Date(preSelectedStart.getTime() + 60 * 60 * 1000)), // default 1 hr later
    note: ''
  });

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const data = await resourceApi.getCars();
        setCars(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, vehicleId: data[0].id }));
        }
      } catch (err) {
        console.error("Lỗi tải danh sách xe:", err);
      }
    };
    fetchCars();
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
        vehicleId: formData.vehicleId,
        title: formData.title,
        departure: formData.departure,
        destination: formData.destination,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        note: formData.note
      };
      
      await bookingApi.createCarBooking(payload);
      toast.success('Đăng ký xe thành công!');
      navigate('/cars');
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Đăng kí Xe công tác</h1>
          <p className="text-sm text-gray-500 mt-1">Vui lòng cung cấp chi tiết hành trình chuyến đi.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-3 rounded bg-red-50 text-red-600 border border-red-100 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Tên chuyến đi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề (Mục đích chuyến đi) <span className="text-red-500">*</span></label>
            <input 
              type="text"
              name="title" 
              value={formData.title}
              onChange={handleChange}
              placeholder="VD: Đi tiếp khách tại Đồng Tháp..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Chọn Xe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Đề xuất Xe <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Truck className="w-5 h-5 text-gray-400" />
              </div>
              <select 
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none bg-white"
                required
              >
                {cars.map(car => (
                  <option key={car.id} value={car.id}>
                    {car.vehicleType?.name || 'Xe'} - {car.licensePlate} ({car.seatCount} chỗ)
                  </option>
                ))}
                {cars.length === 0 && <option value="">Đang tải hoặc không có xe...</option>}
              </select>
            </div>
          </div>

          {/* Hành trình */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Điểm đón <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="w-5 h-5 text-green-500" />
                </div>
                <input 
                  type="text" 
                  name="departure"
                  value={formData.departure}
                  onChange={handleChange}
                  placeholder="VD: Trụ sở công ty"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Điểm đến <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="w-5 h-5 text-red-500" />
                </div>
                <input 
                  type="text" 
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="VD: UBND Tỉnh Đồng Tháp"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Thời gian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian xuất phát <span className="text-red-500">*</span></label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Dự kiến kết thúc <span className="text-red-500">*</span></label>
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

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả chi tiết chuyến đi</label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <AlignLeft className="w-5 h-5 text-gray-400" />
              </div>
              <textarea 
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows="4"
                placeholder="VD: Gồm 3 người đi, dự kiến ở lại qua đêm..."
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

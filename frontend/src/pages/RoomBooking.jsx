import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

export default function RoomBooking() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Đặt phòng họp</h1>
          <p className="text-gray-500 mt-1">Danh sách phòng họp và trạng thái hiện tại.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Đặt phòng ngay
        </Button>
      </div>

      {/* Danh sách phòng Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-400">
              [Hình ảnh phòng họp]
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Phòng Hội đồng {item}</h3>
              <p className="text-sm text-gray-500 mt-1 flex-1">Sức chứa: 20 người • Máy chiếu, Bảng trắng</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                  Đang rảnh
                </span>
                <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
                  Chọn phòng này
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Đặt Phòng */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Yêu cầu đặt phòng họp"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Đã gửi yêu cầu'); setIsModalOpen(false); }}>
          <Input 
            label="Tiêu đề cuộc họp" 
            placeholder="VD: Họp giao ban tuần" 
            required 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Thời gian bắt đầu" 
              type="datetime-local" 
              required 
            />
            <Input 
              label="Thời gian kết thúc" 
              type="datetime-local" 
              required 
            />
          </div>

          <Input 
            label="Số người tham dự dự kiến" 
            type="number" 
            min="1"
            placeholder="10" 
          />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Ghi chú thêm</label>
            <textarea 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              rows={3}
              placeholder="Yêu cầu nước suối, teabreak..."
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">
              Gửi yêu cầu đặt phòng
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

export default function CarBooking() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Đặt xe đi công tác</h1>
          <p className="text-gray-500 mt-1">Danh sách xe nội bộ và tài xế.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Tạo lệnh đặt xe
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Biển số xe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại xe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">29A-123.45</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-500">Toyota Innova (7 chỗ)</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Sẵn sàng</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onClick={() => setIsModalOpen(true)} className="text-blue-600 hover:text-blue-900">Đặt xe này</button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">30G-987.65</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-500">Ford Transit (16 chỗ)</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Đang chạy chuyến</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button disabled className="text-gray-400 cursor-not-allowed">Đặt xe này</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Lệnh đặt xe"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Đã gửi yêu cầu'); setIsModalOpen(false); }}>
          <Input label="Điểm đón" placeholder="VD: Tòa nhà công ty" required />
          <Input label="Điểm đến" placeholder="VD: Sân bay Nội Bài" required />
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="Thời gian đi" type="datetime-local" required />
            <Input label="Thời gian về" type="datetime-local" required />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Gửi yêu cầu đặt xe</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

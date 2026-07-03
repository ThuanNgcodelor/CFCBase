import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { User, Mail, Briefcase, Shield, Key, Camera } from 'lucide-react';

import { authApi } from '../api/authApi';

export default function Profile() {
  const [user, setUser] = useState(authApi.getUser() || {});
  const [fullName, setFullName] = useState(user.fullName || '');
  const [email, setEmail] = useState(user.email || '');
  const [department, setDepartment] = useState(user.department || '');
  const [position, setPosition] = useState(user.position || (user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'));
  const [imageError, setImageError] = useState(false);

  const handleUpdateProfile = () => {
    let newRole = 'EMPLOYEE';
    if (user.role === 'ADMIN') {
      newRole = 'ADMIN';
    } else if (position !== 'Nhân viên') {
      newRole = 'MANAGER';
    }

    const updatedUser = { ...user, fullName, email, department, position, role: newRole };
    setUser(updatedUser);
    authApi.updateUser(updatedUser);
    alert('Cập nhật thông tin thành công!');
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Thiết lập tài khoản</h1>
        <p className="text-gray-500 mt-1">Quản lý thông tin cá nhân và bảo mật của bạn.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* Cột Trái: Card Ảnh đại diện */}
        <div className="w-full lg:w-1/3 shrink-0">
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
            <div className="px-6 pb-6 text-center -mt-16">
              <div className="relative inline-block mb-4">
                <div className="w-32 h-32 mx-auto bg-white rounded-full flex items-center justify-center text-5xl font-bold text-blue-600 shadow-md border-4 border-white overflow-hidden">
                  {user.avatarUrl && !imageError ? (
                    <img
                      src={user.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    user.fullName?.charAt(0) || 'U'
                  )}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{user.fullName || 'Người dùng ẩn danh'}</h2>
              <p className="text-gray-500 mt-1 text-sm">
                {user.position || (user.role === 'ADMIN' ? 'Quản trị viên hệ thống' : 'Nhân viên')}
              </p>
            </div>
            <div className="border-t border-gray-100 p-4 bg-gray-50/50">
              <p className="text-xs text-gray-500 text-center">Tài khoản được tạo tự động qua hệ thống nội bộ.</p>
            </div>
          </div>
        </div>

        {/* Cột Phải: Các Form chỉnh sửa */}
        <div className="w-full lg:w-2/3 space-y-6">

          {/* Card: Thông tin chung */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> Thông tin cơ bản
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phòng ban công tác</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">Chọn phòng ban</option>
                    <option value="Kế Toán">Kế Toán</option>
                    <option value="Kế hoạch vật tư">Kế hoạch vật tư</option>
                    <option value="Kinh Doanh">Kinh Doanh</option>
                    <option value="Xuất nhập khẩu">Xuất nhập khẩu</option>
                    <option value="Tổ chức">Tổ chức</option>
                    <option value="Kĩ thuật">Kĩ thuật</option>
                    <option value="Quản lý chất lượng">Quản lý chất lượng</option>
                    <option value="Kho vận">Kho vận</option>

                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chức vụ (Quyền hạn)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <option value="Nhân viên">Nhân viên</option>
                    <option value="Tổng Giám đốc">Tổng Giám đốc</option>
                    <option value="Phó Giám đốc">Phó Giám đốc</option>
                    <option value="Trưởng phòng">Trưởng phòng</option>
                    <option value="Phó phòng">Phó phòng</option>
                    {user.role === 'ADMIN' && (
                      <option value="Quản trị viên">Quản trị viên</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={handleUpdateProfile}>Lưu thay đổi</Button>
            </div>
          </div>

          {/* Card: Đổi mật khẩu */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-gray-500" /> Đổi mật khẩu
            </h3>

            {user.hasPassword === false ? (
              <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-md border border-gray-200">
                Tài khoản của bạn được liên kết và bảo mật bởi Google. Bạn không cần và không thể đổi mật khẩu tại đây.
              </div>
            ) : (
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu hiện tại</label>
                  <input type="password" placeholder="Nhập mật khẩu cũ" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
                  <input type="password" placeholder="Nhập mật khẩu mới" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu mới</label>
                  <input type="password" placeholder="Nhập lại mật khẩu mới" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" />
                </div>

                <div className="pt-2">
                  <Button variant="outline" className="w-full sm:w-auto">Cập nhật mật khẩu</Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

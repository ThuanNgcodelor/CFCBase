import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { userApi } from '../api/userApi';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

const initialForm = {
  email: '',
  password: '',
  role: 'EMPLOYEE',
  departmentId: '',
};

export default function AdminUsers() {
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departmentLoading, setDepartmentLoading] = useState(true);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const data = await userApi.getDepartments();
        setDepartments(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Không thể tải danh sách phòng ban');
      } finally {
        setDepartmentLoading(false);
      }
    };

    loadDepartments();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!/^\d+$/.test(form.password)) {
      toast.error('Mật khẩu vận hành nên là dãy số');
      return;
    }

    const payload = {
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      departmentId: form.departmentId || null,
    };

    setLoading(true);
    try {
      await userApi.createUser(payload);
      toast.success('Đã tạo tài khoản mới');
      setForm(initialForm);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tạo tài khoản');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl w-full">
      <SEOHead title="CFC Booking | Quản lý tài khoản" url="https://cfcbooking.io.vn/admin/users" />

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          <UserPlus className="h-4 w-4" />
          Quản trị tài khoản
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Tạo tài khoản bằng Email</h1>
        <p className="mt-2 text-sm text-gray-500">
          Admin nhập email và mật khẩu dạng số theo nhu cầu vận hành. Mật khẩu sẽ được mã hóa trước khi lưu.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="staff@company.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Mật khẩu số</label>
              <input
                inputMode="numeric"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value.replace(/\D/g, ''))}
                required
                minLength={4}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="123456"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Vai trò</label>
              <select
                value={form.role}
                onChange={(event) => updateField('role', event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">Phòng ban</label>
              <select
                value={form.departmentId}
                onChange={(event) => updateField('departmentId', event.target.value)}
                disabled={departmentLoading}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
              >
                <option value="">Không chọn phòng ban</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Không hardcode mật khẩu trong code. Nếu dùng mật khẩu chung, nên yêu cầu người dùng đổi mật khẩu sau khi nhận tài khoản.
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

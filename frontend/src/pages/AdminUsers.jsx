import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Users } from 'lucide-react';
import { userApi } from '../api/userApi';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';
import AdminPendingRegistrations from '../components/admin/AdminPendingRegistrations';
import AdminUserDirectory from '../components/admin/AdminUserDirectory';
import { useSearchParams } from 'react-router-dom';

const initialForm = {
  email: '',
  fullName: '',
  password: '',
  role: 'MANAGER',
  departmentId: '',
  jobPosition: '',
};

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
  const [pendingCount, setPendingCount] = useState(0);
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

  useEffect(() => {
    userApi.getPendingRegistrationCount().then(setPendingCount).catch(() => { });
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'pending' || tab === 'create' ? tab : 'all');
  }, [searchParams]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    const payload = {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      password: form.password,
      role: form.role,
      departmentId: form.departmentId || null,
      jobPosition: form.jobPosition.trim() || null,
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
    <div className="mx-auto w-full max-w-[1600px]">
      <SEOHead title="CFC Base | Quản lý tài khoản" url="https://cfcbooking.io.vn/admin/users" />

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          <UserPlus className="h-4 w-4" />
          Quản trị tài khoản
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Quản lý tài khoản</h1>
        <p className="mt-2 text-sm text-gray-500">
          Admin xem mọi tài khoản, phân quyền, khóa/mở và đặt lại mật khẩu. EMPLOYEE không được đăng nhập hệ thống HR.
        </p>
      </div>

      <div className="mb-5 flex w-full flex-wrap rounded-lg border border-gray-200 bg-white p-1 shadow-sm sm:w-fit">
        <button type="button" onClick={() => selectTab('all')} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><Users className="h-4 w-4" />Tất cả tài khoản</button>
        <button type="button" onClick={() => selectTab('pending')} className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'pending' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Chờ phê duyệt{pendingCount > 0 ? ` (${pendingCount})` : ''}</button>
        <button type="button" onClick={() => selectTab('create')} className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Tạo tài khoản</button>
      </div>

      {activeTab === 'all' ? (
        <AdminUserDirectory departments={departments} />
      ) : activeTab === 'pending' ? (
        <AdminPendingRegistrations onCountChange={setPendingCount} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
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
                <label className="text-sm font-medium text-gray-700">Họ và tên</label>
                <input
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Mật khẩu ban đầu</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  required
                  minLength={6}
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
                  <option value="MANAGER">Quản lý nhân sự</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">Chức vụ</label>
                <input
                  value={form.jobPosition}
                  onChange={(event) => updateField('jobPosition', event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ví dụ: Chuyên viên tổ chức"
                />
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
              Chỉ tạo tài khoản MANAGER hoặc ADMIN. Mật khẩu được mã hóa một chiều; sau khi tạo sẽ không thể xem lại, chỉ có thể đặt mật khẩu mới.
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

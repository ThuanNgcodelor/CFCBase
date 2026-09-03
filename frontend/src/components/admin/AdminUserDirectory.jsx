import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Search, ShieldCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi } from '../../api/userApi';
import { formatViDateTime } from '../../utils/dateTime';
import { HrPagination } from '../hr/HrUi';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const EMPTY_RESULT = { content: [], number: 0, totalPages: 0, totalElements: 0 };
const INPUT_CLASS = 'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý nhân sự',
  EMPLOYEE: 'Nhân viên (không đăng nhập)',
};

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã khóa',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  REJECTED: 'Đã từ chối',
};

const STATUS_CLASSES = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  INACTIVE: 'border-gray-200 bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
};

function accountForm(account) {
  return {
    fullName: account?.fullName || '',
    role: account?.role || 'MANAGER',
    status: account?.status || 'ACTIVE',
    departmentId: account?.departmentId || '',
    jobPosition: account?.jobPosition || '',
  };
}

export default function AdminUserDirectory({ departments }) {
  const [result, setResult] = useState(EMPTY_RESULT);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ query: '', role: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(accountForm(null));
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userApi.getUsers({ page, size: 20, ...appliedFilters });
      setResult(data || EMPTY_RESULT);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const submitFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setAppliedFilters({
      query: filters.query.trim(),
      role: filters.role,
      status: filters.status,
    });
  };

  const openEdit = (account) => {
    setEditing(account);
    setEditForm(accountForm(account));
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await userApi.updateUser(editing.id, {
        ...editForm,
        departmentId: editForm.departmentId || null,
        jobPosition: editForm.jobPosition.trim() || null,
      });
      toast.success('Đã cập nhật tài khoản');
      setEditing(null);
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật tài khoản');
    } finally {
      setSaving(false);
    }
  };

  const openPasswordReset = (account) => {
    setResetting(account);
    setNewPassword('');
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setSaving(true);
    try {
      await userApi.resetUserPassword(resetting.id, newPassword);
      toast.success('Đã đặt lại mật khẩu và thu hồi quyền gia hạn các phiên cũ');
      setResetting(null);
      setNewPassword('');
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đặt lại mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 sm:grid-cols-3">
        <div className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" /><span>Xem toàn bộ tài khoản trong hệ thống.</span></div>
        <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Đổi quyền và khóa/mở tài khoản.</span></div>
        <div className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" /><span>Đặt mật khẩu mới; không hiển thị mật khẩu cũ.</span></div>
      </div>

      <form onSubmit={submitFilters} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
        <label className="relative">
          <span className="sr-only">Tìm tài khoản</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            className="min-h-10 w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Tìm theo tên hoặc email"
          />
        </label>
        <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm">
          <option value="">Tất cả vai trò</option>
          <option value="ADMIN">Quản trị viên</option>
          <option value="MANAGER">Quản lý nhân sự</option>
          <option value="EMPLOYEE">Nhân viên (bị chặn)</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="submit" size="sm">Tìm kiếm</Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4">Tài khoản</th>
                <th className="px-5 py-4">Vai trò</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Phòng ban / Chức vụ</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.content.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900">{account.fullName}</div>
                    <div className="mt-0.5 text-sm text-gray-500">{account.email}</div>
                    <div className="mt-1 text-xs text-gray-400">{account.hasPassword ? 'Có mật khẩu' : 'Chưa có mật khẩu'}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{ROLE_LABELS[account.role] || account.role || 'Chưa gán'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[account.status] || STATUS_CLASSES.INACTIVE}`}>
                      {STATUS_LABELS[account.status] || account.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    <div>{account.departmentName || 'Chưa chọn phòng ban'}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{account.jobPosition || 'Chưa nhập chức vụ'}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{formatViDateTime(account.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(account)}><Pencil className="h-4 w-4" />Sửa</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => openPasswordReset(account)}><KeyRound className="h-4 w-4" />Đặt mật khẩu</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && result.content.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-gray-500">Không tìm thấy tài khoản phù hợp.</td></tr>
              )}
              {loading && <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-gray-500">Đang tải danh sách tài khoản...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <HrPagination page={result.number || page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} />

      <Modal isOpen={Boolean(editing)} onClose={() => !saving && setEditing(null)} title="Chỉnh sửa tài khoản">
        <form onSubmit={saveAccount} className="space-y-4">
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{editing?.email}</p>
          <Field label="Họ và tên"><input required value={editForm.fullName} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} className={INPUT_CLASS} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vai trò">
              <select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))} className={INPUT_CLASS}>
                <option value="ADMIN">Quản trị viên</option>
                <option value="MANAGER">Quản lý nhân sự</option>
                <option value="EMPLOYEE">Nhân viên (không đăng nhập)</option>
              </select>
            </Field>
            <Field label="Trạng thái">
              <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Phòng ban">
            <select value={editForm.departmentId} onChange={(event) => setEditForm((current) => ({ ...current, departmentId: event.target.value }))} className={INPUT_CLASS}>
              <option value="">Không chọn phòng ban</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </Field>
          <Field label="Chức vụ"><input value={editForm.jobPosition} onChange={(event) => setEditForm((current) => ({ ...current, jobPosition: event.target.value }))} className={INPUT_CLASS} /></Field>
          <p className="text-xs leading-5 text-gray-500">Đổi vai trò hoặc trạng thái có hiệu lực ngay và sẽ thu hồi các phiên đăng nhập cũ của tài khoản này.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(resetting)} onClose={() => !saving && setResetting(null)} title="Đặt lại mật khẩu">
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
            Đặt mật khẩu mới cho <strong>{resetting?.fullName}</strong>. Hệ thống không thể và không được hiển thị mật khẩu hiện tại.
          </div>
          <p className="text-xs leading-5 text-gray-500">Refresh token cũ sẽ bị thu hồi ngay; access token đang mở sẽ tự hết hạn trong tối đa 30 phút.</p>
          <Field label="Mật khẩu mới">
            <input type="password" autoComplete="new-password" minLength={6} maxLength={100} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={INPUT_CLASS} placeholder="Tối thiểu 6 ký tự" />
          </Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={() => setResetting(null)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang đặt lại...' : 'Đặt mật khẩu mới'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700"><span>{label}</span>{children}</label>;
}

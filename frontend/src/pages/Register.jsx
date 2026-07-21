import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

export default function Register() {
  const [step, setStep] = useState('email');
  const [form, setForm] = useState({ email: '', otp: '', fullName: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.requestRegisterOtp(form.email);
      toast.success('Đã gửi OTP tới email');
      setStep('verify');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể gửi OTP đăng ký');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyRegisterOtp({
        email: form.email,
        otp: form.otp,
        fullName: form.fullName,
        password: form.password,
      });
      setStep('pending');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể hoàn tất đăng ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <SEOHead title="CFC Base | Đăng ký tài khoản" url="https://cfcbooking.io.vn/register" />
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <img src="/logo2.png" alt="CFC Logo" className="w-20 h-20 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-gray-900">Đăng ký tài khoản</h1>
          <p className="text-sm text-gray-500 mt-2">Xác thực email bằng OTP để tạo tài khoản</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang gửi...' : 'Gửi OTP'}
            </Button>
          </form>
        ) : step === 'verify' ? (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="p-3 rounded-md bg-blue-50 text-blue-700 text-sm border border-blue-100">
              <p>OTP đã được gửi tới <strong>{form.email}</strong></p>
              <p className="mt-1 text-xs text-blue-600">
                Nếu chưa thấy email, vui lòng kiểm tra thư mục Spam hoặc Thư rác.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Họ và tên</label>
              <input
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                required
                maxLength={255}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">OTP</label>
              <input
                value={form.otp}
                onChange={(e) => updateField('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                minLength={6}
                maxLength={6}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="123456"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Mật khẩu</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                minLength={6}
                maxLength={72}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Xác nhận mật khẩu</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                minLength={6}
                maxLength={72}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác minh và gửi đăng ký'}
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">✓</div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Đăng ký đã được gửi</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Email <strong>{form.email}</strong> đã được xác minh. Tài khoản đang chờ quản trị viên phê duyệt.
            </p>
            <p className="mt-2 text-sm text-gray-500">Bạn sẽ nhận được email khi tài khoản được kích hoạt.</p>
            <Link to="/login" className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Trở về đăng nhập
            </Link>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

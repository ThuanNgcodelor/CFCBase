import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.requestForgotPasswordOtp(form.email);
      toast.success('Đã gửi OTP đặt lại mật khẩu');
      setStep('reset');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể gửi OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPasswordWithOtp({
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <SEOHead title="CFC Booking | Quên mật khẩu" url="https://cfcbooking.io.vn/forgot-password" />
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <img src="/logo2.png" alt="CFC Logo" className="w-20 h-20 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-gray-900">Quên mật khẩu</h1>
          <p className="text-sm text-gray-500 mt-2">Xác thực OTP qua email để đặt lại mật khẩu</p>
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
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="p-3 rounded-md bg-blue-50 text-blue-700 text-sm border border-blue-100">
              OTP đã được gửi tới <strong>{form.email}</strong>
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
              <label className="text-sm font-medium text-gray-700">Mật khẩu mới</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => updateField('newPassword', e.target.value)}
                required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Nhớ mật khẩu?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

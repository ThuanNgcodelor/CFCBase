import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [form, setForm] = useState({ email: '', otp: '', password: '', confirmPassword: '' });
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
        password: form.password,
      });
      toast.success('Đăng ký thành công. Vui lòng đăng nhập');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể hoàn tất đăng ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <SEOHead title="CFC Booking | Đăng ký tài khoản" url="https://cfcbooking.io.vn/register" />
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
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
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
              <label className="text-sm font-medium text-gray-700">Mật khẩu</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
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
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Hoàn tất đăng ký'}
            </Button>
          </form>
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

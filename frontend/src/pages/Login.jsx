import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

const REMEMBER_KEY = 'cfc_remember_email';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Đọc email đã lưu khi mở trang
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const saveAuthData = (data) => {
    authApi.setAuthData(data);
    window.location.href = '/';
  };

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Xử lý remember me
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    try {
      const data = await authApi.login(email, password);
      saveAuthData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi đăng nhập. Vui lòng kiểm tra lại email/mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <SEOHead
        title="CFC Booking | Đăng nhập hệ thống đặt phòng & xe nội bộ"
        description="Đăng nhập vào CFC Booking — hệ thống quản lý đặt phòng họp và xe công nội bộ của CFC. Nhanh chóng, tiện lợi, bảo mật."
        url="https://cfcbooking.io.vn/login"
      />
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">

        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 flex items-center justify-center mb-2">
            <img src="/logo2.png" alt="CFC Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mt-2">CFC Booking</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Hệ thống đặt phòng họp và xe nội bộ
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-600 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleStandardLogin} className="space-y-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email công ty</label>
            <input
              type="email"
              placeholder="vd: admin1@booking.base.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                Nhớ email
              </label>
            </div>
            <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Quên mật khẩu?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
            Đăng ký bằng email
          </Link>
        </p>
      </div>
    </div>
  );
}

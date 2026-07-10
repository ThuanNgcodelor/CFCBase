import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { baseApi } from '../api/baseApi';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import SEOHead from '../components/SEOHead';

const REMEMBER_KEY = 'cfc_remember_email';

export default function Login() {
  const navigate = useNavigate();
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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await baseApi.post('/auth/google', {
        idToken: credentialResponse.credential,
      });
      saveAuthData(res.data.data);
    } catch (error) {
      toast.error('Đăng nhập Google thất bại: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleGoogleError = () => {
    toast.error('Không thể kết nối với Google. Vui lòng thử lại.');
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

        {/* 
        <form onSubmit={handleStandardLogin} className="space-y-4 mb-4">
          {/* Email * /}
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

          {/* Mật khẩu + toggle hiện/ẩn * /}
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

          {/* Remember Me * /}
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
              Nhớ email đăng nhập
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </Button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Hoặc</span>
          </div>
        </div>
        */}

        <div className="flex justify-center w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <p className="text-xs text-center text-gray-400 mt-8">
          Sử dụng tài khoản Google Workspace hoặc tài khoản hệ thống được cấp.
        </p>
      </div>
    </div>
  );
}

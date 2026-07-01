import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { baseApi } from '../api/baseApi';
import { Building2 } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const saveAuthData = (data) => {
    const { accessToken, refreshToken, user } = data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = '/'; 
  };

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await baseApi.post('/auth/login', { email, password });
      saveAuthData(res.data.data);
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
      alert('Đăng nhập Google thất bại: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleGoogleError = () => {
    alert('Không thể kết nối với Google. Vui lòng thử lại.');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Booking Portal</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Hệ thống đặt phòng họp và xe nội bộ
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-600 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleStandardLogin} className="space-y-4 mb-6">
          <Input 
            label="Email công ty" 
            type="email" 
            placeholder="vd: admin1@booking.base.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <Input 
            label="Mật khẩu" 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
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

import { baseApi } from './baseApi';
import axios from 'axios';
import Cookies from 'js-cookie';
import { pushApi } from './pushApi';
import { clearAppBadge } from '../utils/appBadge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const COOKIE_OPTS = { expires: 7, sameSite: 'Strict' };

export const authApi = {
  setAuthData: (data) => {
    const { accessToken, refreshToken, user } = data;
    Cookies.set('accessToken', accessToken, { ...COOKIE_OPTS, expires: 1/48 });
    Cookies.set('refreshToken', refreshToken, COOKIE_OPTS);
    Cookies.set('user', JSON.stringify(user), COOKIE_OPTS);
  },

  updateUser: (user) => {
    Cookies.set('user', JSON.stringify(user), COOKIE_OPTS);
  },

  // Gọi khi app khởi động: nếu accessToken đã hết hạn nhưng refreshToken còn
  // thì lấy accessToken mới mà không cần user phải đăng nhập lại
  silentRefresh: async () => {
    const refreshToken = Cookies.get('refreshToken');
    if (!refreshToken) return false;
    try {
      const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken, user } = res.data.data;
      Cookies.set('accessToken', accessToken, { ...COOKIE_OPTS, expires: 1/48 });
      Cookies.set('refreshToken', newRefreshToken, COOKIE_OPTS);
      Cookies.set('user', JSON.stringify(user), COOKIE_OPTS);
      return true;
    } catch {
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      Cookies.remove('user');
      return false;
    }
  },

  login: async (email, password) => {
    const response = await baseApi.post('/auth/login', { email, password });
    authApi.setAuthData(response.data.data);
    return response.data.data;
  },

  googleLogin: async (idToken) => {
    const response = await baseApi.post('/auth/google', { idToken });
    authApi.setAuthData(response.data.data);
    return response.data.data;
  },

  requestRegisterOtp: async (email) => {
    const response = await baseApi.post('/auth/register/request-otp', { email });
    return response.data;
  },

  verifyRegisterOtp: async ({ email, otp, password }) => {
    const response = await baseApi.post('/auth/register/verify', { email, otp, password });
    return response.data;
  },

  requestForgotPasswordOtp: async (email) => {
    const response = await baseApi.post('/auth/forgot-password/request-otp', { email });
    return response.data;
  },

  resetPasswordWithOtp: async ({ email, otp, newPassword }) => {
    const response = await baseApi.post('/auth/forgot-password/reset', { email, otp, newPassword });
    return response.data;
  },

  logout: async () => {
    await unsubscribeCurrentPushSubscription();
    const refreshToken = Cookies.get('refreshToken');
    if (refreshToken) {
      try {
        await baseApi.post('/auth/logout', { refreshToken });
      } catch (e) {
        console.error('Logout API error:', e);
      }
    }
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    Cookies.remove('user');
    await clearAppBadge();
  },

  getUser: () => {
    const user = Cookies.get('user');
    return user ? JSON.parse(user) : null;
  }
};

async function unsubscribeCurrentPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return;
    }
    const { endpoint } = subscription;
    try {
      await pushApi.unsubscribe(endpoint);
    } finally {
      await subscription.unsubscribe();
    }
  } catch (e) {
    console.error('Push unsubscribe error:', e);
  }
}

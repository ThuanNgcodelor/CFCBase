import { baseApi, refreshAccessToken } from './baseApi';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { pushApi } from './pushApi';
import { clearAppBadge } from '../utils/appBadge';
import { clearAuthCookies, getStoredUser, isInvalidRefreshError, setAuthCookies } from './authStorage';

let currentUserCache = null;

function getAccessTokenRole() {
  const accessToken = Cookies.get('accessToken');
  if (!accessToken) return null;

  try {
    const payload = jwtDecode(accessToken);
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export const authApi = {
  setAuthData: (data) => {
    currentUserCache = data?.user || null;
    setAuthCookies(data);
  },

  updateUser: (user) => {
    currentUserCache = user || null;
    setAuthCookies({ user });
  },

  silentRefresh: async () => {
    const refreshToken = Cookies.get('refreshToken');
    if (!refreshToken) return false;
    try {
      await refreshAccessToken();
      return true;
    } catch (error) {
      if (!isInvalidRefreshError(error)) throw error;
      clearAuthCookies();
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

  verifyRegisterOtp: async ({ email, otp, fullName, password }) => {
    const response = await baseApi.post('/auth/register/verify', { email, otp, fullName, password });
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
    clearAuthCookies();
    currentUserCache = null;
    await clearAppBadge();
  },

  getUser: () => {
    const storedUser = getStoredUser();
    if (currentUserCache && storedUser) {
      // Giữ dữ liệu đầy đủ (đặc biệt avatar) trong bộ nhớ, nhưng ưu tiên
      // các field quyền/profile mới nhất được cập nhật khi refresh token.
      return { ...currentUserCache, ...storedUser };
    }

    const user = currentUserCache || storedUser;
    if (user) return user;

    const tokenRole = getAccessTokenRole();
    return tokenRole ? { role: tokenRole } : null;
  },

  // Chỉ dùng để quyết định UI route. Backend vẫn là nơi enforce quyền thật.
  getRole: () => getStoredUser()?.role || currentUserCache?.role || getAccessTokenRole() || null,
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

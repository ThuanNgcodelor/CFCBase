import axios from 'axios';
import Cookies from 'js-cookie';
import { clearAuthCookies, isInvalidRefreshError, setAuthCookies } from './authStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const baseApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = Cookies.get('refreshToken');
  if (!refreshToken) {
    const error = new Error('No refresh token available');
    error.code = 'NO_REFRESH_TOKEN';
    return Promise.reject(error);
  }

  refreshPromise = axios.post(`${API_URL}/auth/refresh`, { refreshToken })
    .then((response) => {
      const authData = response.data.data;
      setAuthCookies(authData);
      return authData;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

baseApi.interceptors.request.use(
  (config) => {
    const token = Cookies.get('accessToken');
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else if (!config.url?.startsWith('/auth/')) {
      // Diagnostic without exposing the token: a 401 caused by a missing
      // cookie is different from a token rejected by the backend.
      console.warn('[CFC Auth] Request has no access token', {
        method: config.method,
        url: config.url,
        origin: window.location.origin,
      });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi 401 (Hết hạn Token)
baseApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 và chưa từng thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestHeaders = originalRequest.headers;
      const hasAuthorization = typeof requestHeaders?.get === 'function'
        ? Boolean(requestHeaders.get('Authorization'))
        : Boolean(requestHeaders?.Authorization || requestHeaders?.authorization);
      console.warn('[CFC Auth] 401 response', {
        method: originalRequest.method,
        url: originalRequest.url,
        hasAuthorization,
        hasAccessToken: Boolean(Cookies.get('accessToken')),
        hasRefreshToken: Boolean(Cookies.get('refreshToken')),
      });
      originalRequest._retry = true;

      try {
        const { accessToken } = await refreshAccessToken();

        // Gắn token mới vào request cũ và gọi lại
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return baseApi(originalRequest);
      } catch (refreshError) {
        // Mất mạng/timeout khi iOS vừa khôi phục PWA không có nghĩa phiên đã hết hạn.
        if (!isInvalidRefreshError(refreshError)) {
          return Promise.reject(refreshError);
        }

        clearAuthCookies();
        // Nếu request được đánh dấu `_silent` (polling, background), KHÔNG logout
        // Tránh trường hợp polling tự động kick user ra ngoài
        if (originalRequest._silent) {
          return Promise.reject(refreshError);
        }
        // Request thông thường: xóa token và redirect về login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

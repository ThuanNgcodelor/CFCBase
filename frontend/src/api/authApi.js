import { baseApi } from './baseApi';
import Cookies from 'js-cookie';

export const authApi = {
  login: async (email, password) => {
    const response = await baseApi.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data.data;
    
    Cookies.set('accessToken', accessToken, { expires: 1/48 });
    Cookies.set('refreshToken', refreshToken, { expires: 7 });
    Cookies.set('user', JSON.stringify(user), { expires: 7 });
    
    return response.data.data;
  },

  logout: async () => {
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
  },

  getUser: () => {
    const user = Cookies.get('user');
    return user ? JSON.parse(user) : null;
  }
};

import { baseApi } from './baseApi';

export const dashboardApi = {
  getAdminStats: async () => {
    const response = await baseApi.get('/dashboard/admin');
    return response.data.data;
  },

  getClientStats: async (userId) => {
    const response = await baseApi.get(`/dashboard/client/${userId}`);
    return response.data.data;
  }
};

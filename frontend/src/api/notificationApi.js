import { baseApi } from './baseApi';

export const notificationApi = {
  getNotifications: async (userId) => {
    const response = await baseApi.get(`/notifications/users/${userId}`);
    return response.data.data;
  },

  markAsRead: async (id) => {
    const response = await baseApi.put(`/notifications/${id}/read`);
    return response.data;
  }
};

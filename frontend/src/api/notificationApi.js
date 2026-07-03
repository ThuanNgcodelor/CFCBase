import { baseApi } from './baseApi';

export const notificationApi = {
  getNotifications: async (userId, page = 0, size = 10) => {
    const response = await baseApi.get(`/notifications/users/${userId}?page=${page}&size=${size}`);
    return response.data.data;
  },

  markAsRead: async (id) => {
    const response = await baseApi.put(`/notifications/${id}/read`);
    return response.data;
  }
};

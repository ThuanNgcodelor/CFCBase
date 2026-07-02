import { baseApi } from './baseApi';

export const approvalApi = {
  approveRoom: async (id, data) => {
    const response = await baseApi.post(`/approvals/rooms/${id}/approve`, data);
    return response.data;
  },

  rejectRoom: async (id, data) => {
    const response = await baseApi.post(`/approvals/rooms/${id}/reject`, data);
    return response.data;
  },

  approveCar: async (id, data) => {
    const response = await baseApi.post(`/approvals/cars/${id}/approve`, data);
    return response.data;
  },

  rejectCar: async (id, data) => {
    const response = await baseApi.post(`/approvals/cars/${id}/reject`, data);
    return response.data;
  }
};

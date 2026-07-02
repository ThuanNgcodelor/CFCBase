import { baseApi } from './baseApi';

export const bookingApi = {
  getRoomBookings: async () => {
    const response = await baseApi.get('/bookings/rooms');
    return response.data.data;
  },

  getCarBookings: async () => {
    const response = await baseApi.get('/bookings/cars');
    return response.data.data;
  },

  createRoomBooking: async (data) => {
    const response = await baseApi.post('/bookings/rooms', data);
    return response.data.data;
  },

  createCarBooking: async (data) => {
    const response = await baseApi.post('/bookings/cars', data);
    return response.data.data;
  }
};

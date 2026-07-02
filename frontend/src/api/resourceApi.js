import { baseApi } from './baseApi';

export const resourceApi = {
  getRooms: async () => {
    const response = await baseApi.get('/resources/rooms');
    return response.data.data;
  },
  
  getCars: async () => {
    const response = await baseApi.get('/resources/cars');
    return response.data.data;
  }
};

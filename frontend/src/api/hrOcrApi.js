import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrOcrApi = {
  getSettings: async (options = {}) => {
    const response = await baseApi.get('/hr/ocr/settings', options);
    return unwrapApiData(response);
  },

  updateSettings: async (payload, options = {}) => {
    const response = await baseApi.post('/hr/ocr/settings', payload, options);
    return unwrapApiData(response);
  },

  extractProfile: async (files, options = {}) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await baseApi.post('/hr/ocr/extract-profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
      ...options,
    });
    return unwrapApiData(response);
  },
};

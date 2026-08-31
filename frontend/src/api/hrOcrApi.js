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

    const { headers = {}, ...restOptions } = options;
    const response = await baseApi.post('/hr/ocr/extract-profile', formData, {
      timeout: 120000,
      headers: {
        ...headers,
      },
      ...restOptions,
    });
    return unwrapApiData(response);
  },
};

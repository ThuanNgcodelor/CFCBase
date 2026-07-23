import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrImportApi = {
  getImports: async (params = {}, options = {}) => {
    const response = await baseApi.get('/hr/imports', {
      params: { ...params, size: Math.min(Number(params?.size) || 20, 20) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  uploadBaseline: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const response = await baseApi.post('/hr/imports/baseline', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },

  previewWorkforceSnapshot: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const response = await baseApi.post('/hr/imports/workforce-snapshot/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },

  confirmWorkforceSnapshot: async (file, { confirmationKey, expectedActiveEmployees = 339 }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('confirmationKey', confirmationKey);
    form.append('expectedActiveEmployees', String(expectedActiveEmployees));
    const response = await baseApi.post('/hr/imports/workforce-snapshot/confirm', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },

  getPreview: async (batchId, page = 0, size = 20, options = {}) => {
    const response = await baseApi.get(`/hr/imports/${batchId}/preview`, {
      params: { page, size: Math.min(Number(size) || 20, 20) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  validate: async (batchId) => {
    const response = await baseApi.post(`/hr/imports/${batchId}/validate`, {});
    return unwrapApiData(response);
  },

  confirm: async (batchId, { confirmationKey, acceptWarnings }) => {
    const response = await baseApi.post(`/hr/imports/${batchId}/confirm`, {
      confirmationKey,
      acceptWarnings: Boolean(acceptWarnings),
    });
    return unwrapApiData(response);
  },

  rollback: async (batchId) => {
    const response = await baseApi.post(`/hr/imports/${batchId}/rollback`, {});
    return unwrapApiData(response);
  },
};

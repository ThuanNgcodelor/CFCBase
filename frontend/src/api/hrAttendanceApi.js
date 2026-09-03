import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrAttendanceApi = {
  getSettings: async (options = {}) => unwrapApiData(await baseApi.get('/hr/attendance/settings', options)),
  updateSettings: async (payload) => unwrapApiData(await baseApi.put('/hr/attendance/settings', payload)),
  upload: async (file, options = {}) => {
    const body = new FormData();
    body.append('file', file);
    return unwrapApiData(await baseApi.post('/hr/attendance/imports', body, {
      params: options.month ? { month: options.month } : undefined,
    }));
  },
  uploadBatch: async (files, options = {}) => {
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    return unwrapApiData(await baseApi.post('/hr/attendance/imports/batch', body, {
      params: options.month ? { month: options.month } : undefined,
    }));
  },
  listImports: async (params, options = {}) => unwrapApiData(await baseApi.get('/hr/attendance/imports', { params, signal: options.signal })),
  preview: async (id, params, options = {}) => unwrapApiData(await baseApi.get(`/hr/attendance/imports/${id}/preview`, { params, signal: options.signal })),
  exportFile: async (id) => baseApi.get(`/hr/attendance/imports/${id}/export`, { responseType: 'blob' }),
  exportCong: async (id) => baseApi.get(`/hr/attendance/imports/${id}/cong-export`, { responseType: 'blob' }),
  deleteImport: async (id) => unwrapApiData(await baseApi.delete(`/hr/attendance/imports/${id}`)),
};

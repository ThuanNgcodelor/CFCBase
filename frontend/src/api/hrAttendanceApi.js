import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrAttendanceApi = {
  getSettings: async (options = {}) => unwrapApiData(await baseApi.get('/hr/attendance/settings', options)),
  updateSettings: async (payload) => unwrapApiData(await baseApi.put('/hr/attendance/settings', payload)),
  upload: async (file) => {
    const body = new FormData();
    body.append('file', file);
    return unwrapApiData(await baseApi.post('/hr/attendance/imports', body));
  },
  listImports: async (params, options = {}) => unwrapApiData(await baseApi.get('/hr/attendance/imports', { params, signal: options.signal })),
  preview: async (id, params, options = {}) => unwrapApiData(await baseApi.get(`/hr/attendance/imports/${id}/preview`, { params, signal: options.signal })),
};

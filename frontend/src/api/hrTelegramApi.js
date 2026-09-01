import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const hrTelegramApi = {
  getSettings: async (options = {}) => unwrapApiData(await baseApi.get('/hr/telegram/settings', { signal: options.signal })),
  updateSettings: async (payload) => unwrapApiData(await baseApi.put('/hr/telegram/settings', payload)),
  testConnection: async () => unwrapApiData(await baseApi.post('/hr/telegram/test-connection')),
  getCommonLink: async (options = {}) => unwrapApiData(await baseApi.get('/hr/telegram/common-link', { signal: options.signal })),
  getSummary: async (options = {}) => unwrapApiData(await baseApi.get('/hr/telegram/summary', { signal: options.signal })),
  getRegistrations: async (params, options = {}) => unwrapApiData(await baseApi.get('/hr/telegram/registrations', {
    params,
    signal: options.signal,
  })),
  verify: async (id, note = '') => unwrapApiData(await baseApi.post(`/hr/telegram/registrations/${id}/verify`, { note })),
  reject: async (id, note = '') => unwrapApiData(await baseApi.post(`/hr/telegram/registrations/${id}/reject`, { note })),
  revoke: async (employeeId, note = '') => unwrapApiData(await baseApi.post(`/hr/telegram/employees/${employeeId}/revoke`, { note })),
  exportRegistrations: async (status) => {
    const response = await baseApi.get('/hr/telegram/registrations/export', {
      params: status ? { status } : undefined,
      responseType: 'blob',
    });
    downloadBlob(response.data, 'telegram-nhan-vien.xlsx');
  },
};

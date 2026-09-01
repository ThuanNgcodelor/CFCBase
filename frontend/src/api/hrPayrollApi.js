import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrPayrollApi = {
  listImports: async (params, options = {}) => unwrapApiData(await baseApi.get('/hr/payroll/imports', { params, signal: options.signal })),
  upload: async (file) => {
    const body = new FormData();
    body.append('file', file);
    return unwrapApiData(await baseApi.post('/hr/payroll/imports', body));
  },
  preview: async (id, params, options = {}) => unwrapApiData(await baseApi.get(`/hr/payroll/imports/${id}/preview`, { params, signal: options.signal })),
  createCampaign: async (id) => unwrapApiData(await baseApi.post(`/hr/payroll/imports/${id}/campaigns`, { deliveryMode: 'TEXT' })),
  campaign: async (id, options = {}) => unwrapApiData(await baseApi.get(`/hr/payroll/campaigns/${id}`, { signal: options.signal, _silent: true })),
  start: async (id) => unwrapApiData(await baseApi.post(`/hr/payroll/campaigns/${id}/start`)),
  retry: async (id) => unwrapApiData(await baseApi.post(`/hr/payroll/campaigns/${id}/retry`)),
  deliveries: async (id, params, options = {}) => unwrapApiData(await baseApi.get(`/hr/payroll/campaigns/${id}/deliveries`, { params, signal: options.signal })),
};

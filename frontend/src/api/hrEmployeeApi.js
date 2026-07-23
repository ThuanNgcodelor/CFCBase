import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrEmployeeApi = {
  getOverview: async (options = {}) => {
    const response = await baseApi.get('/hr/overview', { signal: options.signal });
    return unwrapApiData(response);
  },

  getEmployees: async (params, options = {}) => {
    const response = await baseApi.get('/hr/employees', {
      params: { ...params, size: Math.min(Number(params?.size) || 20, 20) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getEmployee: async (id, options = {}) => {
    const response = await baseApi.get(`/hr/employees/${id}`, { signal: options.signal });
    return unwrapApiData(response);
  },

  createEmployee: async (payload) => {
    const response = await baseApi.post('/hr/employees', payload);
    return unwrapApiData(response);
  },

  updateEmployee: async (id, payload) => {
    const response = await baseApi.patch(`/hr/employees/${id}`, payload);
    return unwrapApiData(response);
  },

  deleteDraftEmployee: async (id, rowVersion) => {
    const response = await baseApi.delete(`/hr/employees/${id}`, { params: { rowVersion } });
    return unwrapApiData(response);
  },
};

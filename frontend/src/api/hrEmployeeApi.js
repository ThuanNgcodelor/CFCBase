import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

function buildEmployeeSearchParams(params = {}) {
  const cleaned = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '') return;
    cleaned[key] = normalized;
  });

  const requestedPage = Number(cleaned.page);
  const requestedSize = Number(cleaned.size);
  cleaned.page = Number.isFinite(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  cleaned.size = Math.min(
    Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : 20,
    50,
  );

  return cleaned;
}

export const hrEmployeeApi = {
  getOverview: async (options = {}) => {
    const response = await baseApi.get('/hr/overview', { signal: options.signal });
    return unwrapApiData(response);
  },

  getEmployees: async (params, options = {}) => {
    const response = await baseApi.get('/hr/employees', {
      params: buildEmployeeSearchParams(params),
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

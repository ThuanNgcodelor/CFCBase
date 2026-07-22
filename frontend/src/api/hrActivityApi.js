import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

function boundedParams(params) {
  return { ...params, size: Math.min(Number(params?.size) || 20, 20) };
}

export const hrActivityApi = {
  getMovements: async (params, options = {}) => {
    const response = await baseApi.get('/hr/movements', {
      params: boundedParams(params),
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getRosters: async (params, options = {}) => {
    const response = await baseApi.get('/hr/rosters', {
      params: boundedParams(params),
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getRosterItems: async (id, params, options = {}) => {
    const response = await baseApi.get(`/hr/rosters/${id}/items`, {
      params: boundedParams(params),
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getAuditEvents: async (params, options = {}) => {
    const response = await baseApi.get('/hr/audit', {
      params: boundedParams(params),
      signal: options.signal,
    });
    return unwrapApiData(response);
  },
};

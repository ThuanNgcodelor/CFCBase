import { baseApi } from './baseApi';
import { normalizePage, unwrapApiData } from './hrApiUtils';

export const hrProbationApi = {
  getCandidates: async (params = {}, options = {}) => {
    const response = await baseApi.get('/hr/probation/candidates', {
      params: { ...params, size: Math.min(Number(params?.size) || 20, 50) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getCandidate: async (id, options = {}) => {
    const response = await baseApi.get(`/hr/probation/candidates/${id}`, { signal: options.signal });
    return unwrapApiData(response);
  },

  createCandidate: async (payload) => {
    const response = await baseApi.post('/hr/probation/candidates', payload);
    return unwrapApiData(response);
  },

  updateCandidate: async (id, payload) => {
    const response = await baseApi.patch(`/hr/probation/candidates/${id}`, payload);
    return unwrapApiData(response);
  },

  generateContract: async (id, payload = {}) => {
    const response = await baseApi.post(`/hr/probation/candidates/${id}/contracts`, payload);
    return unwrapApiData(response);
  },

  downloadContract: async (contractId) => {
    const response = await baseApi.get(`/hr/probation/contracts/${contractId}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  startProbation: async (id, payload) => {
    const response = await baseApi.post(`/hr/probation/candidates/${id}/start`, payload);
    return unwrapApiData(response);
  },

  markPassed: async (id, payload) => {
    const response = await baseApi.post(`/hr/probation/candidates/${id}/pass`, payload);
    return unwrapApiData(response);
  },

  markFailed: async (id, payload) => {
    const response = await baseApi.post(`/hr/probation/candidates/${id}/fail`, payload);
    return unwrapApiData(response);
  },

  convertToEmployeeDraft: async (id, payload) => {
    const response = await baseApi.post(`/hr/probation/candidates/${id}/convert-to-employee-draft`, payload);
    return unwrapApiData(response);
  },

  getJobTemplates: async (params = {}, options = {}) => {
    const response = await baseApi.get('/hr/probation/job-templates', {
      params: { ...params, size: Math.min(Number(params?.size) || 20, 50) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getAllJobTemplates: async (params = {}, options = {}) => {
    const size = 50;
    const firstPage = normalizePage(await hrProbationApi.getJobTemplates(
      { ...params, page: 0, size },
      options,
    ));
    const items = [...firstPage.content];
    for (let page = 1; page < firstPage.totalPages; page += 1) {
      const nextPage = normalizePage(await hrProbationApi.getJobTemplates(
        { ...params, page, size },
        options,
      ));
      items.push(...nextPage.content);
    }
    return items;
  },

  createJobTemplate: async (payload) => {
    const response = await baseApi.post('/hr/probation/job-templates', payload);
    return unwrapApiData(response);
  },

  updateJobTemplate: async (id, payload) => {
    const response = await baseApi.patch(`/hr/probation/job-templates/${id}`, payload);
    return unwrapApiData(response);
  },
};

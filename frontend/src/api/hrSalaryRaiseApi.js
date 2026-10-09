import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrSalaryRaiseApi = {
  reviews: async (params = {}, options = {}) => unwrapApiData(await baseApi.get('/hr/salary-raises/reviews', {
    params: {
      bucket: params.bucket || 'ALL',
      keyword: params.keyword || undefined,
      departmentId: params.departmentId || undefined,
      page: params.page || 0,
      size: Math.min(Number(params.size) || 20, 100),
    },
    signal: options.signal,
  })),

  updateReview: async (employeeId, payload) => unwrapApiData(await baseApi.patch(
    `/hr/salary-raises/reviews/${employeeId}`, payload,
  )),

  imports: async (params = {}, options = {}) => unwrapApiData(await baseApi.get('/hr/salary-raises/imports', {
    params: { page: params.page || 0, size: Math.min(Number(params.size) || 20, 50) },
    signal: options.signal,
  })),

  upload: async (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrapApiData(await baseApi.post('/hr/salary-raises/imports', form));
  },

  preview: async (batchId, page = 0, options = {}) => unwrapApiData(await baseApi.get(
    `/hr/salary-raises/imports/${batchId}/preview`, { params: { page, size: 20 }, signal: options.signal },
  )),

  validate: async (batchId) => unwrapApiData(await baseApi.post(`/hr/salary-raises/imports/${batchId}/validate`, {})),

  confirm: async (batchId, confirmationKey, acceptWarnings) => unwrapApiData(await baseApi.post(
    `/hr/salary-raises/imports/${batchId}/confirm`, { confirmationKey, acceptWarnings },
  )),

  rollback: async (batchId, reason) => unwrapApiData(await baseApi.post(
    `/hr/salary-raises/imports/${batchId}/rollback`, { reason },
  )),

  deleteImport: async (batchId) => unwrapApiData(await baseApi.delete(
    `/hr/salary-raises/imports/${batchId}`,
  )),
};

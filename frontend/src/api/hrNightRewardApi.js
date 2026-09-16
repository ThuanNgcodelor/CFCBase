import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

const root = '/hr/attendance/night-rewards';

export const hrNightRewardApi = {
  month: async (month) => unwrapApiData(await baseApi.get(`${root}/months/${month}`)),
  finalizeMonth: async (month, payload) => unwrapApiData(await baseApi.post(`${root}/months/${month}/finalize`, payload)),
  exceptions: async (month) => unwrapApiData(await baseApi.get(`${root}/exceptions`, { params: { month } })),
  createException: async (payload) => unwrapApiData(await baseApi.post(`${root}/exceptions`, payload)),
  approveException: async (id, payload) => unwrapApiData(await baseApi.post(`${root}/exceptions/${id}/approve`, payload)),
  rejectException: async (id, payload) => unwrapApiData(await baseApi.post(`${root}/exceptions/${id}/reject`, payload)),
  cancelException: async (id, payload) => unwrapApiData(await baseApi.post(`${root}/exceptions/${id}/cancel`, payload)),
  timeline: async (employeeCode) => unwrapApiData(await baseApi.get(`${root}/employees/${encodeURIComponent(employeeCode)}/timeline`)),
};

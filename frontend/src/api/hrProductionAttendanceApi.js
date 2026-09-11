import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

const root = '/hr/attendance/production';

export const hrProductionAttendanceApi = {
  listImports: async (params = {}) => unwrapApiData(await baseApi.get(`${root}/imports`, { params })),
  upload: async (file, month) => {
    const body = new FormData();
    body.append('file', file);
    return unwrapApiData(await baseApi.post(`${root}/imports`, body, { params: month ? { month } : undefined }));
  },
  recalculate: async (id) => unwrapApiData(await baseApi.post(`${root}/imports/${id}/recalculate`)),
  confirmImport: async (id) => unwrapApiData(await baseApi.post(`${root}/imports/${id}/confirm`)),
  reopenImport: async (id, payload) => unwrapApiData(await baseApi.post(`${root}/imports/${id}/reopen`, payload)),
  shifts: async (params) => unwrapApiData(await baseApi.get(`${root}/shifts`, { params })),
  shiftPunches: async (id) => unwrapApiData(await baseApi.get(`${root}/shifts/${id}/punches`)),
  decideShift: async (id, payload) => unwrapApiData(await baseApi.put(`${root}/shifts/${id}/decision`, payload)),
  adjustments: async (id) => unwrapApiData(await baseApi.get(`${root}/shifts/${id}/adjustments`)),
  bulkConfirm: async (payload) => unwrapApiData(await baseApi.post(`${root}/shifts/bulk-confirm`, payload)),
  summary: async (month) => unwrapApiData(await baseApi.get(`${root}/summary`, { params: { month } })),
  exportSummary: async (month) => baseApi.get(`${root}/summary/export`, { params: { month }, responseType: 'blob' }),
  shiftPolicies: async () => unwrapApiData(await baseApi.get(`${root}/shift-policies`)),
  updateShiftPolicy: async (id, payload) => unwrapApiData(await baseApi.put(`${root}/shift-policies/${id}`, payload)),
  workCreditRules: async () => unwrapApiData(await baseApi.get(`${root}/work-credit-rules`)),
  updateWorkCreditRule: async (id, payload) => unwrapApiData(await baseApi.put(`${root}/work-credit-rules/${id}`, payload)),
  employeePolicies: async (employeeCode) => unwrapApiData(await baseApi.get(`${root}/employee-policies`, { params: { employeeCode } })),
  createEmployeePolicy: async (payload) => unwrapApiData(await baseApi.post(`${root}/employee-policies`, payload)),
  exemptions: async (employeeCode) => unwrapApiData(await baseApi.get(`${root}/exemptions`, { params: { employeeCode } })),
  createExemption: async (payload) => unwrapApiData(await baseApi.post(`${root}/exemptions`, payload)),
  cancelExemption: async (id, payload) => unwrapApiData(await baseApi.post(`${root}/exemptions/${id}/cancel`, payload)),
  incidents: async (params = {}) => unwrapApiData(await baseApi.get(`${root}/incidents`, { params })),
  createIncident: async (payload) => unwrapApiData(await baseApi.post(`${root}/incidents`, payload)),
  analyzeIncident: async (id, importId) => unwrapApiData(await baseApi.post(`${root}/incidents/${id}/analyze`, null, { params: { importId } })),
  confirmIncident: async (id, importId, payload) => unwrapApiData(await baseApi.post(`${root}/incidents/${id}/confirm`, payload, { params: { importId } })),
  cancelIncident: async (id) => unwrapApiData(await baseApi.post(`${root}/incidents/${id}/cancel`)),
};

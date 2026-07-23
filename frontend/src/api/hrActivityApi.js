import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

function boundedParams(params) {
  return { ...params, size: Math.min(Number(params?.size) || 20, 20) };
}

async function fetchRosters(params, options = {}) {
  const response = await baseApi.get('/hr/rosters', {
    params: { ...params, size: Math.min(Number(params?.size) || 20, 50) },
    signal: options.signal,
  });
  return unwrapApiData(response);
}

function fileNameFromDisposition(value, fallback) {
  if (!value) return fallback;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

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

async function downloadExport(path, params, fallbackFileName) {
  const response = await baseApi.get(path, { params, responseType: 'blob' });
  const fileName = fileNameFromDisposition(response.headers['content-disposition'], fallbackFileName);
  downloadBlob(response.data, fileName);
}

export const hrActivityApi = {
  getMovements: async (params, options = {}) => {
    const response = await baseApi.get('/hr/movements', {
      params: boundedParams(params),
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  createMovement: async (payload) => {
    const response = await baseApi.post('/hr/movements', payload);
    return unwrapApiData(response);
  },

  confirmMovement: async (id, rowVersion) => {
    const response = await baseApi.post(`/hr/movements/${id}/confirm`, { rowVersion });
    return unwrapApiData(response);
  },

  cancelMovement: async (id, rowVersion) => {
    const response = await baseApi.post(`/hr/movements/${id}/cancel`, { rowVersion });
    return unwrapApiData(response);
  },

  deleteMovement: async (id, rowVersion) => {
    const response = await baseApi.delete(`/hr/movements/${id}`, { params: { rowVersion } });
    return unwrapApiData(response);
  },

  getRosters: async (params, options = {}) => {
    return fetchRosters(params, options);
  },

  getRosterById: async (id, options = {}) => {
    const response = await baseApi.get(`/hr/rosters/${id}`, { signal: options.signal });
    return unwrapApiData(response);
  },

  createRoster: async (periodStart) => {
    const response = await baseApi.post('/hr/rosters', { periodStart });
    return unwrapApiData(response);
  },

  openRoster: async (id, rowVersion) => {
    const response = await baseApi.post(`/hr/rosters/${id}/open`, { rowVersion });
    return unwrapApiData(response);
  },

  closeRoster: async (id, rowVersion) => {
    const response = await baseApi.post(`/hr/rosters/${id}/close`, { rowVersion });
    return unwrapApiData(response);
  },

  reopenRoster: async (id, rowVersion, reason) => {
    const response = await baseApi.post(`/hr/rosters/${id}/reopen`, { rowVersion, reason });
    return unwrapApiData(response);
  },

  deleteRoster: async (id, rowVersion) => {
    const response = await baseApi.delete(`/hr/rosters/${id}`, { params: { rowVersion } });
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

  exportMonth: async ({ year, month }) => {
    await downloadExport('/hr/exports/month', { year, month }, `hr-T${month}-${String(year).slice(-2)}.xlsx`);
  },

  exportYear: async ({ year }) => {
    await downloadExport('/hr/exports/year', { year }, `hr-nam-${year}.xlsx`);
  },
};

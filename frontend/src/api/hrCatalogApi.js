import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const HR_CATALOG_TYPES = ['departments', 'positions', 'working-conditions'];

function requireCatalogType(type) {
  if (!HR_CATALOG_TYPES.includes(type)) {
    throw new Error('Danh mục HR không hợp lệ');
  }
}

export const hrCatalogApi = {
  getCatalog: async (type, params = {}, options = {}) => {
    requireCatalogType(type);
    const response = await baseApi.get(`/hr/catalogs/${type}`, {
      params: { ...params, size: Math.min(Number(params?.size) || 20, 20) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  createCatalogItem: async (type, payload) => {
    requireCatalogType(type);
    const response = await baseApi.post(`/hr/catalogs/${type}`, payload);
    return unwrapApiData(response);
  },

  updateCatalogItem: async (type, id, payload) => {
    requireCatalogType(type);
    const response = await baseApi.patch(`/hr/catalogs/${type}/${id}`, payload);
    return unwrapApiData(response);
  },
};

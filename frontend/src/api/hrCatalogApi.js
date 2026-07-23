import { baseApi } from './baseApi';
import { normalizePage, unwrapApiData } from './hrApiUtils';

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
      params: { ...params, size: Math.min(Number(params?.size) || 20, 50) },
      signal: options.signal,
    });
    return unwrapApiData(response);
  },

  getAllCatalogItems: async (type, params = {}, options = {}) => {
    requireCatalogType(type);
    const size = 50;
    const firstPage = normalizePage(await hrCatalogApi.getCatalog(
      type,
      { ...params, page: 0, size },
      options,
    ));
    const items = [...firstPage.content];

    for (let page = 1; page < firstPage.totalPages; page += 1) {
      const nextPage = normalizePage(await hrCatalogApi.getCatalog(
        type,
        { ...params, page, size },
        options,
      ));
      items.push(...nextPage.content);
    }

    return items;
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

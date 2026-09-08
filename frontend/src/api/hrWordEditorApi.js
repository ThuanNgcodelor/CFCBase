import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';
const root = '/hr/word-editor/sessions';
export const hrWordEditorApi = {
  open: async request => unwrapApiData(await baseApi.post(root, request)),
  state: async (id, signal) => unwrapApiData(await baseApi.get(`${root}/${id}`, { signal })),
  config: async (id, signal) => unwrapApiData(await baseApi.get(`${root}/${id}/config`, { signal })),
  draft: async id => (await baseApi.get(`${root}/${id}/draft`, { responseType: 'blob' })).data,
  publish: async (id, note) => unwrapApiData(await baseApi.post(`${root}/${id}/publish`, { note })),
  cancel: async id => unwrapApiData(await baseApi.post(`${root}/${id}/cancel`)),
};

import { baseApi } from './baseApi';
const ROOT = '/hr/general-labor/ocr-captures';
const data = (response) => response.data.data;
export const hrOcrCaptureApi = {
  open: (id) => baseApi.post(ROOT, { id }).then(data),
  get: (id) => baseApi.get(`${ROOT}/${id}`, { _silent: true }).then(data),
  pair: (id) => baseApi.post(`${ROOT}/${id}/pair`, {}).then(data),
  image: (id, imageId, signal) => baseApi.get(`${ROOT}/${id}/images/${imageId}`, { responseType: 'blob', signal, _silent: true }).then((r) => r.data),
  upload: (id, pending) => {
    const form = new FormData();
    form.append('file', pending.file);
    form.append('kind', pending.kind);
    form.append('clientId', pending.clientId);
    return baseApi.post(`${ROOT}/${id}/images`, form, { timeout: 60000 }).then(data);
  },
  remove: (id, imageId) => baseApi.delete(`${ROOT}/${id}/images/${imageId}`).then(data),
  scan: (id, revision) => baseApi.post(`${ROOT}/${id}/scan`, { revision }).then(data),
  close: (id, completed = false) => baseApi.post(`${ROOT}/${id}/close`, { completed }).then(data),
};

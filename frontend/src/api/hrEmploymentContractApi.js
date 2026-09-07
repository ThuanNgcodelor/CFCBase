import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrEmploymentContractApi = {
  uploadRevision: async (documentId, file, note) => {
    const body = new FormData(); body.append('file', file); body.append('note', note);
    return unwrapApiData(await baseApi.post(`/hr/employment-contract-documents/${documentId}/revisions`, body));
  },
  generateDocument: async (contractId) => {
    if (!contractId) throw new Error('Employment contract id is required');
    const response = await baseApi.post(`/hr/employment-contracts/${contractId}/documents`);
    return unwrapApiData(response);
  },

  downloadDocument: async (documentId) => {
    if (!documentId) throw new Error('Employment contract document id is required');
    return baseApi.get(
      `/hr/employment-contract-documents/${documentId}/download`,
      { responseType: 'blob' },
    );
  },
};

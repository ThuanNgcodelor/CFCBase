import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrEmploymentContractApi = {
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

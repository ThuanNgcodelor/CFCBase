import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrEmployeeDocumentApi = {
  getDocuments: async (employeeId, category) => {
    if (!employeeId) throw new Error('Employee id is required');
    const params = category ? { category } : {};
    const response = await baseApi.get(`/hr/employees/${employeeId}/documents`, { params });
    return unwrapApiData(response);
  },

  uploadDocument: async (employeeId, formData) => {
    if (!employeeId) throw new Error('Employee id is required');
    const response = await baseApi.post(
      `/hr/employees/${employeeId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return unwrapApiData(response);
  },

  getDocument: async (documentId) => {
    if (!documentId) throw new Error('Document id is required');
    const response = await baseApi.get(`/hr/employee-documents/${documentId}`);
    return unwrapApiData(response);
  },

  viewDocumentBlob: async (documentId) => {
    if (!documentId) throw new Error('Document id is required');
    return baseApi.get(
      `/hr/employee-documents/${documentId}/view`,
      { responseType: 'blob' },
    );
  },

  downloadDocument: async (documentId) => {
    if (!documentId) throw new Error('Document id is required');
    return baseApi.get(
      `/hr/employee-documents/${documentId}/download`,
      { responseType: 'blob' },
    );
  },

  updateDocument: async (documentId, data) => {
    if (!documentId) throw new Error('Document id is required');
    const response = await baseApi.patch(`/hr/employee-documents/${documentId}`, data);
    return unwrapApiData(response);
  },

  deleteDocument: async (documentId, rowVersion) => {
    if (!documentId) throw new Error('Document id is required');
    const response = await baseApi.delete(`/hr/employee-documents/${documentId}`, {
      params: { rowVersion },
    });
    return unwrapApiData(response);
  },
};

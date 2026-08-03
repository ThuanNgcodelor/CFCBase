import {
  mockCandidates,
  mockCatalogs,
  mockEmployees,
  mockJobTemplates,
  mockMovements,
  mockOverview,
  mockRosters
} from '../data/mockData.js';

const getMockRosters = () => {
  const scenario = typeof URLSearchParams === 'function'
    ? new URLSearchParams(globalThis.location?.search || '').get('mockRosters')
    : '';
  return scenario === 'current-only' ? mockRosters.slice(0, 1) : mockRosters;
};

const mockHandlers = {
  apiBootstrap: () => ({
    overview: mockOverview,
    employees: mockEmployees,
    candidates: mockCandidates,
    jobTemplates: mockJobTemplates,
    movements: mockMovements,
    rosters: getMockRosters(),
    catalogs: mockCatalogs
  }),
  apiGetOverview: () => mockOverview,
  apiGetEmployees: () => mockEmployees,
  apiGetEmployee: (id) => {
    const employee = mockEmployees.find((item) => String(item.id) === String(id));
    if (!employee) throw new Error('Không tìm thấy hồ sơ nhân sự.');
    return employee;
  },
  apiSearchEmployees: (keyword = '', department = '', status = '') => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return mockEmployees.filter((employee) => {
      const matchesKeyword = !normalized
        || `${employee.code} ${employee.fullName} ${employee.position}`
          .toLocaleLowerCase('vi')
          .includes(normalized);
      return matchesKeyword
        && (!department || employee.department === department)
        && (!status || employee.status === status);
    });
  },
  apiGetProbationCandidates: () => mockCandidates,
  apiGetProbationJobTemplates: () => mockJobTemplates,
  apiGetChangeLogs: () => mockMovements,
  apiGetRosters: () => getMockRosters(),
  apiGetCatalogs: () => mockCatalogs,
  apiSaveEmployeeDraft: (payload) => ({ ...payload, id: `emp-${Date.now()}`, status: 'DRAFT' }),
  apiSaveProbationCandidate: (payload) => ({
    ...payload,
    id: `candidate-${Date.now()}`,
    status: 'DRAFT',
    candidateCode: payload.candidateCode || `TV-${String(Date.now()).slice(-12)}`
  }),
  apiSaveProbationJobTemplate: (payload) => ({
    ...payload,
    id: payload.id || `template-${Date.now()}`,
    rowVersion: Number(payload.rowVersion || 0) + 1,
    status: 'DRAFT'
  }),
  apiRunProbationAction: (id, action, payload = {}) => {
    const normalized = String(action || '').toUpperCase();
    if (normalized.includes('TEMPLATE')) {
      const template = mockJobTemplates.find((item) => String(item.id) === String(id));
      return {
        ...template,
        id,
        rowVersion: Number(payload.row_version || template?.rowVersion || 0) + 1,
        status: normalized.startsWith('INACTIVATE') ? 'INACTIVE' : 'ACTIVE'
      };
    }
    if (normalized === 'GENERATE_DOCUMENT' || normalized === 'GENERATE_CONTRACT') {
      return {
        generated_document_id: `document-${Date.now()}`,
        candidate_id: id,
        contract_no: '01',
        generation_status: 'GENERATED',
        has_docx: true,
        has_pdf: true
      };
    }
    const candidate = mockCandidates.find((item) => String(item.id) === String(id));
    const statusByAction = {
      START: 'IN_PROBATION',
      START_PROBATION: 'IN_PROBATION',
      PASS: 'PASSED',
      MARK_PASSED: 'PASSED',
      FAIL: 'FAILED',
      MARK_FAILED: 'FAILED',
      CANCEL: 'CANCELLED',
      CONVERT: 'CONVERTED'
    };
    return {
      ...candidate,
      id,
      rowVersion: Number(payload.row_version || candidate?.rowVersion || 0) + 1,
      status: statusByAction[normalized] || candidate?.status || 'DRAFT'
    };
  },
  apiLogChange: (payload) => ({ ...payload, id: `movement-${Date.now()}`, status: 'DRAFT' }),
  apiPreviewChange: (movementId) => {
    const movement = mockMovements.find((item) => String(item.id) === String(movementId));
    const before = mockOverview.active;
    return {
      movementId,
      effectiveDate: movement?.effectiveDate || '',
      activeCountBefore: before,
      activeCountAfter: before + (movement?.type === 'DECREASE' ? -1 : 1)
    };
  },
  apiConfirmChange: (movementId) => ({ id: movementId, status: 'CONFIRMED' }),
  apiCancelChange: (movementId, reason) => ({ id: movementId, status: 'CANCELLED', cancellationReason: reason }),
  apiGetMonthlyExcelExportUrl: () => '',
  apiExportMonthlyWorkbook: (year, month) => {
    const normalizedYear = Number(year) || new Date().getFullYear();
    const normalizedMonth = Number(month) || new Date().getMonth() + 1;
    const mockContent = `Mock XLSX export for ${normalizedMonth}/${normalizedYear}`;
    const base64 = globalThis.btoa
      ? globalThis.btoa(mockContent)
      : '';
    return {
      fileName: `Danh sách nhân sự tháng ${String(normalizedMonth).padStart(2, '0')}-${normalizedYear}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64
    };
  },
  apiPreviewLegacyImport: () => ({
    sourceSheet: 'T6-26',
    headerRow: 4,
    totalRows: 337,
    importableRows: 331,
    duplicateRows: 4,
    errorRows: 2,
    warnings: [
      '4 hồ sơ đã tồn tại theo mã nhân sự và sẽ được bỏ qua.',
      '2 dòng thiếu mã nhân sự hoặc họ tên cần được sửa trong tab nguồn.'
    ],
    sample: mockEmployees.slice(0, 5).map((employee, index) => ({
      sourceRow: index + 5,
      employeeCode: employee.code,
      fullName: employee.fullName,
      department: employee.department,
      position: employee.position
    })),
    previewToken: `legacy-preview-${Date.now()}`
  }),
  apiConfirmLegacyImport: (previewToken) => {
    if (!previewToken) throw new Error('Phiên xem trước không còn hợp lệ.');
    return {
      insertedEmployees: 331,
      skippedEmployees: 6,
      createdDepartments: 12,
      createdPositions: 42,
      createdWorkingConditions: 5,
      warnings: ['Các dòng trùng hoặc chưa hợp lệ đã được giữ nguyên trong tab nguồn để đối soát.']
    };
  },
  apiSaveCatalog: (catalogType, payload) => ({
    ...payload,
    id: payload.id || `${catalogType}-${Date.now()}`,
    status: payload.status || 'ACTIVE'
  })
};

export const isGoogleScriptRuntime = () =>
  Boolean(globalThis.google?.script?.run);

const unwrapResponse = (response) => {
  if (response && typeof response === 'object' && response.success === false) {
    throw new Error(response.message || 'Yêu cầu không thành công.');
  }
  if (response && typeof response === 'object' && response.success === true && 'data' in response) {
    return response.data;
  }
  return response;
};

const runMock = (method, args) => new Promise((resolve, reject) => {
  globalThis.setTimeout(() => {
    try {
      const handler = mockHandlers[method];
      if (!handler) throw new Error(`Mock RPC chưa hỗ trợ ${method}.`);
      resolve(unwrapResponse(handler(...args)));
    } catch (error) {
      reject(error);
    }
  }, 260);
});

export const callRpc = (method, ...args) => {
  if (!isGoogleScriptRuntime()) return runMock(method, args);

  return new Promise((resolve, reject) => {
    try {
      const runner = globalThis.google.script.run
        .withSuccessHandler((response) => {
          try {
            resolve(unwrapResponse(response));
          } catch (error) {
            reject(error);
          }
        })
        .withFailureHandler((error) => {
          reject(new Error(error?.message || 'Không thể kết nối Apps Script.'));
        });

      if (typeof runner[method] !== 'function') {
        reject(new Error(`RPC ${method} chưa được triển khai ở server.`));
        return;
      }
      runner[method](...args);
    } catch (error) {
      reject(error);
    }
  });
};

export const hrRpc = {
  bootstrap: () => callRpc('apiBootstrap'),
  getOverview: () => callRpc('apiGetOverview'),
  getEmployees: () => callRpc('apiGetEmployees'),
  getEmployee: (id) => callRpc('apiGetEmployee', id),
  searchEmployees: (filters) => callRpc(
    'apiSearchEmployees',
    filters.keyword,
    filters.department,
    filters.status
  ),
  getCandidates: () => callRpc('apiGetProbationCandidates'),
  getJobTemplates: () => callRpc('apiGetProbationJobTemplates'),
  getMovements: () => callRpc('apiGetChangeLogs', null, null),
  getRosters: () => callRpc('apiGetRosters'),
  getCatalogs: () => callRpc('apiGetCatalogs'),
  saveEmployeeDraft: (payload) => callRpc('apiSaveEmployeeDraft', payload),
  saveCandidate: (payload) => callRpc('apiSaveProbationCandidate', payload),
  saveJobTemplate: (payload) => callRpc('apiSaveProbationJobTemplate', payload),
  runProbationAction: (id, action, payload) => callRpc(
    'apiRunProbationAction',
    id,
    action,
    payload
  ),
  saveMovementDraft: (payload) => callRpc('apiLogChange', payload),
  previewMovement: (movementId) => callRpc('apiPreviewChange', movementId),
  confirmMovement: (movementId) => callRpc('apiConfirmChange', movementId),
  cancelMovement: (movementId, reason) => callRpc('apiCancelChange', movementId, reason),
  getMonthlyExportUrl: (year, month) => callRpc('apiGetMonthlyExcelExportUrl', year, month),
  exportMonthlyWorkbook: (year, month) => callRpc('apiExportMonthlyWorkbook', year, month),
  previewLegacyImport: () => callRpc('apiPreviewLegacyImport'),
  confirmLegacyImport: (previewToken) => callRpc('apiConfirmLegacyImport', previewToken),
  saveCatalog: (catalogType, payload) => callRpc('apiSaveCatalog', catalogType, payload)
};

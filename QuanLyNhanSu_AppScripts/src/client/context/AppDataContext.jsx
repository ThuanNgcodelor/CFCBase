import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hrRpc, isGoogleScriptRuntime } from '../api/rpc.js';
import {
  mockAuditEvents,
  mockCandidates,
  mockCatalogs,
  mockEmployees,
  mockJobTemplates,
  mockMovements,
  mockOverview,
  mockRosters
} from '../data/mockData.js';
import { normalizeEmployee } from '../lib/format.js';

const AppDataContext = createContext(null);

const initialData = isGoogleScriptRuntime()
  ? {
      overview: { total: 0, active: 0, draft: 0, inactive: 0 },
      employees: [],
      candidates: [],
      jobTemplates: [],
      movements: [],
      rosters: [],
      catalogs: { departments: [], positions: [], conditions: [] },
      auditEvents: []
    }
  : {
      overview: mockOverview,
      employees: mockEmployees,
      candidates: mockCandidates,
      jobTemplates: mockJobTemplates,
      movements: mockMovements,
      rosters: mockRosters,
      catalogs: mockCatalogs,
      auditEvents: mockAuditEvents
    };

export function AppDataProvider({ children }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const toastSequence = useRef(0);

  const notify = useCallback((message, tone = 'success') => {
    toastSequence.current += 1;
    const id = toastSequence.current;
    setToasts((current) => [...current, { id, message, tone }]);
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bootstrapPayload = await hrRpc.bootstrap();
      const {
        overview,
        employees,
        candidates,
        jobTemplates,
        movements,
        rosters,
        catalogs,
        auditEvents
      } = bootstrapPayload || {};
      const normalizedEmployees = Array.isArray(employees)
        ? employees.map(normalizeEmployee)
        : [];
      setData((current) => ({
        ...current,
        overview: overview && typeof overview === 'object'
          ? overview
          : {
              total: normalizedEmployees.length,
              active: normalizedEmployees.filter((item) => item.status === 'ACTIVE').length,
              draft: normalizedEmployees.filter((item) => item.status === 'DRAFT').length,
              inactive: normalizedEmployees.filter((item) => item.status === 'INACTIVE').length
            },
        employees: normalizedEmployees,
        candidates: Array.isArray(candidates) ? candidates : [],
        jobTemplates: Array.isArray(jobTemplates) ? jobTemplates : [],
        movements: Array.isArray(movements) ? movements : current.movements,
        rosters: Array.isArray(rosters) ? rosters : [],
        catalogs: catalogs && typeof catalogs === 'object'
          ? catalogs
          : { departments: [], positions: [], conditions: [] },
        auditEvents: Array.isArray(auditEvents) ? auditEvents : []
      }));
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải dữ liệu nhân sự.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const addEmployeeDraft = useCallback(async (payload) => {
    const saved = await hrRpc.saveEmployeeDraft(payload);
    const normalized = normalizeEmployee(saved);
    setData((current) => ({
      ...current,
      employees: [normalized, ...current.employees],
      overview: {
        ...current.overview,
        total: current.overview.total + 1,
        draft: current.overview.draft + 1
      }
    }));
    notify('Đã lưu hồ sơ nhân sự nháp.');
    return normalized;
  }, [notify]);

  const updateEmployee = useCallback(async (id, payload) => {
    const saved = await hrRpc.saveEmployeeDraft({ ...payload, id });
    const normalized = normalizeEmployee(saved);
    setData((current) => ({
      ...current,
      employees: current.employees.map((employee) => employee.id === id ? normalized : employee)
    }));
    notify('Đã cập nhật hồ sơ nhân sự.');
    return normalized;
  }, [notify]);

  const addCandidate = useCallback(async (payload) => {
    const saved = await hrRpc.saveCandidate(payload);
    setData((current) => ({ ...current, candidates: [saved, ...current.candidates] }));
    notify('Đã thêm ứng viên thử việc.');
    return saved;
  }, [notify]);

  const updateCandidate = useCallback(async (id, payload) => {
    const saved = await hrRpc.saveCandidate({ ...payload, id });
    setData((current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === id ? saved : candidate)
    }));
    notify('Đã cập nhật ứng viên thử việc.');
    return saved;
  }, [notify]);

  const saveJobTemplate = useCallback(async (id, payload) => {
    const saved = await hrRpc.saveJobTemplate({ ...payload, id: id || undefined });
    setData((current) => ({
      ...current,
      jobTemplates: id
        ? current.jobTemplates.map((template) => template.id === id ? saved : template)
        : [saved, ...current.jobTemplates]
    }));
    notify(id ? 'Đã cập nhật mẫu công việc.' : 'Đã thêm mẫu công việc.');
    return saved;
  }, [notify]);

  const runProbationAction = useCallback(async (record, action, payload = {}) => {
    const id = record.id || record.candidateId;
    const request = {
      ...payload,
      row_version: record.rowVersion,
      idempotencyKey: payload.idempotencyKey
        || `${String(action).toLowerCase()}-${id}-${Date.now()}`
    };
    const result = await hrRpc.runProbationAction(id, action, request);
    const normalizedAction = String(action).toUpperCase();

    if (normalizedAction.includes('TEMPLATE')) {
      setData((current) => ({
        ...current,
        jobTemplates: current.jobTemplates.map((template) =>
          String(template.id) === String(id) ? result : template
        )
      }));
      notify(normalizedAction.startsWith('INACTIVATE')
        ? 'Đã ngừng sử dụng mẫu công việc.'
        : 'Đã kích hoạt mẫu công việc.');
      return result;
    }

    if (isGoogleScriptRuntime()) {
      await bootstrap();
    } else if (normalizedAction === 'GENERATE_DOCUMENT' || normalizedAction === 'GENERATE_CONTRACT') {
      setData((current) => ({
        ...current,
        candidates: current.candidates.map((candidate) =>
          String(candidate.id) === String(id)
            ? {
                ...candidate,
                status: 'CONTRACT_CREATED',
                latestContract: {
                  id: result.generated_document_id,
                  contractNo: result.contract_no,
                  status: result.generation_status,
                  hasDocx: result.has_docx,
                  hasPdf: result.has_pdf
                }
              }
            : candidate
        )
      }));
    } else {
      const updatedCandidate = result?.candidate || result;
      setData((current) => ({
        ...current,
        candidates: current.candidates.map((candidate) =>
          String(candidate.id) === String(id) ? updatedCandidate : candidate
        )
      }));
    }

    const successMessages = {
      GENERATE_DOCUMENT: 'Đã sinh hợp đồng thử việc.',
      START_PROBATION: 'Đã bắt đầu quá trình thử việc.',
      MARK_PASSED: 'Đã ghi nhận ứng viên đạt thử việc.',
      MARK_FAILED: 'Đã ghi nhận ứng viên không đạt.',
      CONVERT: 'Đã chuyển ứng viên thành hồ sơ nhân sự nháp.'
    };
    notify(successMessages[normalizedAction] || 'Đã cập nhật hồ sơ thử việc.');
    return result;
  }, [bootstrap, notify]);

  const addMovementDraft = useCallback(async (payload) => {
    const saved = await hrRpc.saveMovementDraft(payload);
    setData((current) => ({ ...current, movements: [saved, ...current.movements] }));
    notify('Đã lưu bản nháp biến động.');
    return saved;
  }, [notify]);

  const previewMovement = useCallback((movementId) => hrRpc.previewMovement(movementId), []);

  const confirmMovement = useCallback(async (movementId) => {
    await hrRpc.confirmMovement(movementId);
    notify('Đã xác nhận biến động và cập nhật danh sách tháng.');
    await bootstrap();
  }, [bootstrap, notify]);

  const cancelMovement = useCallback(async (movementId, reason) => {
    await hrRpc.cancelMovement(movementId, reason);
    notify('Đã hủy bản nháp biến động.', 'info');
    await bootstrap();
  }, [bootstrap, notify]);

  const getMonthlyExportUrl = useCallback(
    (year, month) => hrRpc.getMonthlyExportUrl(year, month),
    []
  );

  const exportMonthlyWorkbook = useCallback(
    (year, month) => hrRpc.exportMonthlyWorkbook(year, month),
    []
  );

  const previewLegacyImport = useCallback(() => hrRpc.previewLegacyImport(), []);

  const confirmLegacyImport = useCallback(async (previewToken) => {
    const result = await hrRpc.confirmLegacyImport(previewToken);
    notify(`Đã nhập ${Number(result?.insertedEmployees || 0).toLocaleString('vi-VN')} hồ sơ nhân sự.`);
    await bootstrap();
    return result;
  }, [bootstrap, notify]);

  const saveCatalog = useCallback(async (catalogType, payload) => {
    const saved = await hrRpc.saveCatalog(catalogType, payload);
    setData((current) => {
      const catalogItems = current.catalogs[catalogType] || [];
      const exists = catalogItems.some((item) => String(item.id) === String(saved.id));
      return {
        ...current,
        catalogs: {
          ...current.catalogs,
          [catalogType]: exists
            ? catalogItems.map((item) => String(item.id) === String(saved.id) ? saved : item)
            : [saved, ...catalogItems]
        }
      };
    });
    notify(payload.id ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
    return saved;
  }, [notify]);

  const value = useMemo(() => ({
    ...data,
    loading,
    error,
    isMock: !isGoogleScriptRuntime(),
    toasts,
    reload: bootstrap,
    notify,
    addEmployeeDraft,
    updateEmployee,
    addCandidate,
    updateCandidate,
    saveJobTemplate,
    runProbationAction,
    addMovementDraft,
    previewMovement,
    confirmMovement,
    cancelMovement,
    getMonthlyExportUrl,
    exportMonthlyWorkbook,
    previewLegacyImport,
    confirmLegacyImport,
    saveCatalog
  }), [
    data,
    loading,
    error,
    toasts,
    bootstrap,
    notify,
    addEmployeeDraft,
    updateEmployee,
    addCandidate,
    updateCandidate,
    saveJobTemplate,
    runProbationAction,
    addMovementDraft,
    previewMovement,
    confirmMovement,
    cancelMovement,
    getMonthlyExportUrl,
    exportMonthlyWorkbook,
    previewLegacyImport,
    confirmLegacyImport,
    saveCatalog
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider.');
  return context;
};

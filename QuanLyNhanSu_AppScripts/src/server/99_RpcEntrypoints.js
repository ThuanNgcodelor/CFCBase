/**
 * HTMLService entrypoint and stable React RPC contract.
 *
 * Authentication/role checks are intentionally deferred for this internal MVP
 * at the user's request. Every mutation still receives one stable internal
 * actor, correlation ID, validation, lock/version checks and an audit event.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CFC Base - Quản lý nhân sự')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function hrRpc_(work) {
  var context = HrCore.context();
  try {
    return {
      success: true,
      data: work(context),
      message: null,
      meta: {
        requestId: context.requestId,
        releaseVersion: HrConfig.get(
          HrConfig.KEYS.APP_RELEASE_VERSION,
          'local-development'
        )
      }
    };
  } catch (sourceError) {
    var safe = HrCore.sanitizeError(sourceError);
    try {
      console.error(JSON.stringify({
        requestId: context.requestId,
        code: safe.code,
        message: safe.message
      }));
    } catch (ignored) {
      // Returning the sanitized envelope is more important than console output.
    }
    return {
      success: false,
      data: null,
      message: safe.message,
      error: safe,
      meta: {
        requestId: context.requestId,
        releaseVersion: HrConfig.get(
          HrConfig.KEYS.APP_RELEASE_VERSION,
          'local-development'
        )
      }
    };
  }
}

function hrRows_(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

function hrLegacyImportPreviewDto_(preview) {
  preview = preview || {};
  var summary = preview.summary || {};
  var issues = Array.isArray(preview.issues) ? preview.issues : [];
  var errorRows = {};
  issues.forEach(function (issue) {
    if (issue && issue.severity === 'ERROR' && issue.row_number) {
      errorRows[issue.row_number] = true;
    }
  });
  var ready = preview.ready_to_confirm === true;
  return {
    sourceSheet: preview.source && preview.source.sheet_name || '',
    headerRow: Number(preview.source && preview.source.header_row || 0),
    totalRows: Number(summary.source_rows || 0),
    importableRows: ready ? Number(summary.new_employees || 0) : 0,
    duplicateRows: Number(summary.existing_employee_codes || 0),
    errorRows: Number(
      summary.invalid_rows === undefined
        ? Object.keys(errorRows).length
        : summary.invalid_rows
    ),
    warningCount: Number(summary.warning_count || 0),
    warnings: issues.filter(function (issue) {
      return issue && issue.severity === 'WARNING';
    }).map(function (issue) {
      return {
        rowNumber: issue.row_number || null,
        field: issue.field || null,
        code: issue.code || null,
        message: issue.message || 'Dữ liệu cần kiểm tra.'
      };
    }),
    // The import preview deliberately returns counts/issues instead of raw HR
    // records. This keeps the RPC response free of unnecessary PII.
    sample: [],
    previewToken: ready && preview.confirmation
      ? preview.confirmation.confirmation_token
      : null,
    readyToConfirm: ready,
    message: preview.message || '',
    omittedIssueCount: Number(preview.omitted_issue_count || 0),
    catalogs: summary.catalogs || {}
  };
}

function hrCatalogKind_(value) {
  var normalized = String(value || '').trim().toUpperCase();
  var aliases = {
    DEPARTMENTS: 'DEPARTMENT',
    DEPARTMENT: 'DEPARTMENT',
    POSITIONS: 'POSITION',
    POSITION: 'POSITION',
    CONDITIONS: 'WORKING_CONDITION',
    WORKING_CONDITIONS: 'WORKING_CONDITION',
    WORKING_CONDITION: 'WORKING_CONDITION'
  };
  HrCore.assert(
    aliases[normalized],
    'CATALOG_KIND_INVALID',
    'Loại danh mục không được hỗ trợ.'
  );
  return aliases[normalized];
}

function hrCatalogInput_(payload) {
  payload = payload || {};
  return {
    id: payload.id || null,
    code: payload.code,
    name: payload.name,
    description: payload.description || null,
    parent_department_id: payload.parentId || payload.parent_department_id || null,
    sort_order: payload.sortOrder === undefined
      ? (payload.sort_order || 0)
      : payload.sortOrder,
    row_version: payload.rowVersion === undefined
      ? payload.row_version
      : payload.rowVersion
  };
}

function hrRawCatalogs_() {
  return HrClientMapper.rawCatalogs();
}

function hrEmployeePage_(query, catalogs) {
  var page = HrEmployeeService.list(query || {
    page: 1,
    pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
  });
  return {
    items: hrRows_(page).map(function (row) {
      return HrClientMapper.employee(row, catalogs);
    }),
    total: page.total || 0,
    page: page.page || 1,
    pageSize: page.pageSize || hrRows_(page).length,
    totalPages: page.totalPages || 0
  };
}

function hrMovementPage_(query) {
  var page = HrWorkforceService.list(query || {
    page: 1,
    pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
  });
  return {
    items: hrRows_(page).map(HrClientMapper.movement),
    total: page.total || 0,
    page: page.page || 1,
    pageSize: page.pageSize || hrRows_(page).length,
    totalPages: page.totalPages || 0
  };
}

function hrCandidatePage_(query, catalogs, documents) {
  var page = HrProbationService.listCandidates(query || {
    page: 1,
    pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
  });
  return {
    items: hrRows_(page).map(function (row) {
      return HrClientMapper.candidate(row, catalogs, documents);
    }),
    total: page.total || 0,
    page: page.page || 1,
    pageSize: page.pageSize || hrRows_(page).length,
    totalPages: page.totalPages || 0
  };
}

function hrTemplateRows_(query, catalogs) {
  var result = HrProbationService.listJobTemplates(query || { status: 'ALL' });
  return hrRows_(result).map(function (row) {
    return HrClientMapper.template(row, catalogs);
  });
}

function hrRosterRows_(query) {
  var result = HrWorkforceService.listRosters(query || {});
  return hrRows_(result).map(HrClientMapper.roster);
}

function hrAuditRows_() {
  return HrSheetStore.list(HrSchema.TABLES.AUDIT_LOGS, {
    sortBy: 'occurred_at',
    sortDirection: 'DESC',
    limit: 50
  }).map(HrClientMapper.audit);
}

function hrDocumentRows_() {
  var result = HrDocumentService.list({
    page: 1,
    pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
  });
  return hrRows_(result);
}

function hrSaveEmployee_(payload, context) {
  var catalogs = hrRawCatalogs_();
  var input = HrClientMapper.employeeInput(payload, catalogs);
  var result = HrEmployeeService.saveDraft(input, {
    context: context,
    expectedRowVersion: input.row_version
  });
  var row = result && result.employee ? result.employee : result;
  return HrClientMapper.employee(row, catalogs);
}

function hrSaveCandidate_(payload, context) {
  var catalogs = hrRawCatalogs_();
  var input = HrClientMapper.candidateInput(payload, catalogs);
  var row = HrProbationService.saveCandidate(input, {
    context: context,
    expectedRowVersion: input.row_version
  });
  return HrClientMapper.candidate(row, catalogs, hrDocumentRows_());
}

function hrSaveTemplate_(payload, context) {
  var catalogs = hrRawCatalogs_();
  var input = HrClientMapper.templateInput(payload, catalogs);
  var row = HrProbationService.saveJobTemplate(input, {
    context: context,
    expectedRowVersion: input.row_version
  });
  return HrClientMapper.template(row, catalogs);
}

function hrMovementById_(movementId) {
  var row = HrSheetStore.get(
    HrSchema.TABLES.WORKFORCE_MOVEMENTS,
    HrCore.requireString(movementId, 'movementId', 200)
  );
  HrCore.assert(row, 'MOVEMENT_NOT_FOUND', 'Không tìm thấy biến động nhân sự.');
  return row;
}

/**
 * One initial RPC keeps Apps Script from starting seven concurrent executions
 * that all validate and read the same Sheet ranges.
 */
function apiBootstrap() {
  return hrRpc_(function () {
    HrSheetStore.bootstrap();
    var catalogs = hrRawCatalogs_();
    var documents = hrDocumentRows_();
    return {
      overview: HrClientMapper.overview(HrDashboardService.getOverview({})),
      employees: hrEmployeePage_({
        page: 1,
        pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
      }, catalogs).items,
      candidates: hrCandidatePage_({
        page: 1,
        pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
      }, catalogs, documents).items,
      jobTemplates: hrTemplateRows_({ status: 'ALL' }, catalogs),
      movements: hrMovementPage_({
        page: 1,
        pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
      }).items,
      rosters: hrRosterRows_({}),
      catalogs: HrClientMapper.catalogs(catalogs),
      auditEvents: hrAuditRows_()
    };
  });
}

function apiListEmployees(query) {
  return hrRpc_(function () {
    var catalogs = hrRawCatalogs_();
    return hrEmployeePage_(query || {}, catalogs);
  });
}

function apiGetEmployee(employeeId) {
  return hrRpc_(function () {
    return HrClientMapper.employee(
      HrEmployeeService.get(employeeId, { includeSensitive: true }),
      hrRawCatalogs_()
    );
  });
}

function apiSaveEmployee(payload) {
  return hrRpc_(function (context) {
    return hrSaveEmployee_(payload, context);
  });
}

function apiListCatalogs(query) {
  return hrRpc_(function () {
    var raw = HrCatalogService.getAll(query || { status: 'ALL' });
    return HrClientMapper.catalogs({
      departments: raw.departments,
      positions: raw.positions,
      conditions: raw.working_conditions
    });
  });
}

function apiSaveCatalog(kind, payload) {
  return hrRpc_(function (context) {
    var normalizedKind = hrCatalogKind_(kind);
    var input = hrCatalogInput_(payload);
    var saved = HrCatalogService.save(normalizedKind, input, {
      context: context,
      expectedRowVersion: input.row_version
    });
    return HrClientMapper.catalog(saved, normalizedKind);
  });
}

function apiListMovements(query) {
  return hrRpc_(function () {
    return hrMovementPage_(query || {});
  });
}

function apiCreateMovement(payload) {
  return hrRpc_(function (context) {
    var input = HrClientMapper.movementInput(payload);
    var created = HrWorkforceService.createDraft(input, {
      context: context,
      expectedRowVersion: input.row_version
    });
    return HrClientMapper.movement(created);
  });
}

function apiPreviewMovement(movementId) {
  return hrRpc_(function () {
    return HrWorkforceService.preview(movementId);
  });
}

function apiConfirmMovement(movementId) {
  return hrRpc_(function (context) {
    var current = hrMovementById_(movementId);
    if (current.movement_status === 'CONFIRMED') {
      return HrClientMapper.movement(current);
    }
    var key = [
      'MOVEMENT_CONFIRM',
      current.movement_id,
      current.row_version
    ].join(':');
    return HrClientMapper.movement(HrWorkforceService.confirm(
      current.movement_id,
      current.row_version,
      key,
      { context: context, idempotencyKey: key }
    ));
  });
}

function apiCancelMovement(movementId, reason) {
  return hrRpc_(function (context) {
    var current = hrMovementById_(movementId);
    return HrClientMapper.movement(HrWorkforceService.cancel(
      current.movement_id,
      current.row_version,
      reason,
      { context: context }
    ));
  });
}

function apiListRosters(query) {
  return hrRpc_(function () {
    return hrRosterRows_(query || {});
  });
}

function apiListProbationCandidates(query) {
  return hrRpc_(function () {
    var catalogs = hrRawCatalogs_();
    return hrCandidatePage_(query || {}, catalogs, hrDocumentRows_());
  });
}

function apiSaveProbationCandidate(payload) {
  return hrRpc_(function (context) {
    return hrSaveCandidate_(payload, context);
  });
}

function apiListProbationJobTemplates(query) {
  return hrRpc_(function () {
    return hrTemplateRows_(query || { status: 'ALL' }, hrRawCatalogs_());
  });
}

function apiSaveProbationJobTemplate(payload) {
  return hrRpc_(function (context) {
    return hrSaveTemplate_(payload, context);
  });
}

function apiRunProbationAction(candidateId, action, payload) {
  return hrRpc_(function (context) {
    payload = payload || {};
    if (String(action || '').toUpperCase().indexOf('TEMPLATE') >= 0) {
      return HrClientMapper.template(
        HrProbationService.runAction(candidateId, action, payload, {
          context: context
        }),
        hrRawCatalogs_()
      );
    }
    var result = HrProbationService.runAction(candidateId, action, payload, {
      context: context,
      idempotencyKey: payload.idempotencyKey || payload.idempotency_key
    });
    if (result && result.candidate) {
      return {
        candidate: HrClientMapper.candidate(
          result.candidate,
          hrRawCatalogs_(),
          hrDocumentRows_()
        ),
        employee: result.employee
          ? HrClientMapper.employee(result.employee, hrRawCatalogs_())
          : null,
        warnings: result.warnings || []
      };
    }
    if (result && result.generated_document_id) return result;
    return HrClientMapper.candidate(
      result,
      hrRawCatalogs_(),
      hrDocumentRows_()
    );
  });
}

function apiGetOverview(query) {
  return hrRpc_(function () {
    return HrClientMapper.overview(HrDashboardService.getOverview(query || {}));
  });
}

function apiListGeneratedDocuments(query) {
  return hrRpc_(function () {
    return HrDocumentService.list(query || {});
  });
}

function apiGetGeneratedDocument(documentId) {
  return hrRpc_(function () {
    return HrDocumentService.get(documentId, { includeStorageIds: false });
  });
}

// ---- React compatibility aliases ----

function apiGetEmployees() {
  return hrRpc_(function () {
    return hrEmployeePage_({
      page: 1,
      pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
    }, hrRawCatalogs_()).items;
  });
}

function apiSearchEmployees(keyword, department, status) {
  return hrRpc_(function () {
    return hrEmployeePage_({
      keyword: keyword || '',
      department: department || '',
      status: status || '',
      page: 1,
      pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
    }, hrRawCatalogs_()).items;
  });
}

function apiGetProbationCandidates() {
  return hrRpc_(function () {
    var catalogs = hrRawCatalogs_();
    return hrCandidatePage_({
      page: 1,
      pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
    }, catalogs, hrDocumentRows_()).items;
  });
}

function apiGetProbationJobTemplates() {
  return hrRpc_(function () {
    return hrTemplateRows_({ status: 'ALL' }, hrRawCatalogs_());
  });
}

function apiGetChangeLogs(month, year) {
  return hrRpc_(function () {
    var query = {
      page: 1,
      pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
    };
    if (month && year) {
      var padded = String(month).padStart(2, '0');
      var last = new Date(Number(year), Number(month), 0).getDate();
      query.from_date = year + '-' + padded + '-01';
      query.to_date = year + '-' + padded + '-' + String(last).padStart(2, '0');
    }
    return hrMovementPage_(query).items;
  });
}

function apiGetRosters() {
  return hrRpc_(function () {
    return hrRosterRows_({});
  });
}

function apiGetCatalogs() {
  return apiListCatalogs({ status: 'ALL' });
}

function apiSaveEmployeeDraft(payload) {
  return apiSaveEmployee(payload);
}

function apiLogChange(payload) {
  return apiCreateMovement(payload);
}

function apiPreviewChange(movementId) {
  return hrRpc_(function () {
    var preview = HrWorkforceService.preview(movementId);
    return {
      movementId: preview.movement_id,
      effectiveDate: preview.effective_date,
      activeCountBefore: preview.active_count_before,
      activeCountAfter: preview.active_count_after,
      before: preview.before,
      after: preview.after,
      warnings: preview.warnings || []
    };
  });
}

function apiConfirmChange(movementId) {
  return apiConfirmMovement(movementId);
}

function apiCancelChange(movementId, reason) {
  return apiCancelMovement(movementId, reason);
}

function apiPreviewLegacyImport() {
  return hrRpc_(function () {
    return hrLegacyImportPreviewDto_(HrLegacyImportService.preview());
  });
}

function apiConfirmLegacyImport(previewToken) {
  return hrRpc_(function (context) {
    var token = String(previewToken || '').trim().toLowerCase();
    HrCore.assert(
      token,
      'LEGACY_IMPORT_CONFIRMATION_REQUIRED',
      'Hãy xem trước dữ liệu trước khi xác nhận nhập.'
    );
    var currentPreview = HrLegacyImportService.preview();
    HrCore.assert(
      currentPreview.ready_to_confirm === true &&
        currentPreview.confirmation &&
        currentPreview.confirmation.confirmation_token === token,
      'LEGACY_IMPORT_SOURCE_CHANGED',
      'Dữ liệu nguồn đã thay đổi; hãy xem trước lại trước khi nhập.'
    );
    var result = HrLegacyImportService.confirm(
      currentPreview.confirmation,
      { context: context }
    );
    var summary = result.summary || {};
    return {
      insertedEmployees: Number(summary.imported_employees || 0),
      skippedEmployees: Number(summary.skipped_existing_employees || 0),
      appliedSourceEmployees: Number(summary.applied_source_employees || 0),
      activeEmployeesAfter: Number(summary.active_employees_after || 0),
      createdDepartments: Number(summary.created_departments || 0),
      createdPositions: Number(summary.created_positions || 0),
      createdWorkingConditions: Number(summary.created_working_conditions || 0),
      replayed: result.replayed === true,
      warnings: [],
      message: result.message || 'Đã hoàn tất nhập dữ liệu nhân sự.'
    };
  });
}

function apiExportMonthlyWorkbook(year, month) {
  return hrRpc_(function () {
    return HrMonthlyExportService.exportMonth(year, month);
  });
}

// Compatibility alias for clients from the previous deployment. The method no
// longer exposes the database spreadsheet URL; it returns the same private XLSX
// payload as apiExportMonthlyWorkbook.
function apiGetMonthlyExcelExportUrl(year, month) {
  return apiExportMonthlyWorkbook(year, month);
}

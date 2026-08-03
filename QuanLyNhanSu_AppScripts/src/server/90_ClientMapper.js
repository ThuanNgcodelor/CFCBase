/**
 * Explicit boundary between the canonical snake_case Sheet model and the
 * camelCase React view model. Keeping the conversion here prevents UI labels
 * (for example a department name) from leaking into foreign-key columns.
 */
var HrClientMapper = (function () {
  'use strict';

  function trim_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function normalize_(value) {
    var text = trim_(value).toLowerCase();
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text.replace(/\s+/g, ' ');
  }

  function nullable_(value) {
    var text = trim_(value);
    return text ? text : null;
  }

  function numberOrNull_(value) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = Number(value);
    HrCore.assert(isFinite(parsed), 'NUMBER_INVALID', 'Giá trị số không hợp lệ.');
    return parsed;
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function rawCatalogs_() {
    var source = HrCatalogService.getAll({ status: 'ALL' });
    return {
      departments: rows_(source.departments),
      positions: rows_(source.positions),
      conditions: rows_(source.working_conditions || source.conditions)
    };
  }

  function indexCatalogs_(catalogs) {
    var result = {
      departments: {},
      positions: {},
      conditions: {}
    };
    Object.keys(result).forEach(function (kind) {
      (catalogs[kind] || []).forEach(function (item) {
        result[kind][item.department_id || item.position_id ||
          item.working_condition_id || item.id] = item;
      });
    });
    return result;
  }

  function catalogId_(items, explicitId, label, fieldName) {
    if (trim_(explicitId)) return trim_(explicitId);
    var requested = normalize_(label);
    if (!requested) return null;
    var match = (items || []).filter(function (item) {
      return [
        item.department_id,
        item.position_id,
        item.working_condition_id,
        item.id,
        item.code,
        item.name
      ].some(function (value) { return normalize_(value) === requested; });
    })[0];
    HrCore.assert(
      match,
      'CATALOG_REFERENCE_NOT_FOUND',
      'Không tìm thấy danh mục đã chọn.',
      { field: fieldName }
    );
    return match.department_id || match.position_id ||
      match.working_condition_id || match.id;
  }

  function genderToClient_(value) {
    return ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNKNOWN: '' })[
      trim_(value).toUpperCase()
    ] || trim_(value);
  }

  function genderToServer_(value) {
    var normalized = normalize_(value).toUpperCase();
    return ({ NAM: 'MALE', NU: 'FEMALE', KHAC: 'OTHER', MALE: 'MALE',
      FEMALE: 'FEMALE', OTHER: 'OTHER', UNKNOWN: 'UNKNOWN' })[normalized] || 'UNKNOWN';
  }

  function contractTypeLabel_(value) {
    var normalized = trim_(value).toUpperCase();
    var labels = {
      INDEFINITE: 'Không xác định thời hạn',
      UNLIMITED: 'Không xác định thời hạn',
      FIXED_TERM: 'Xác định thời hạn',
      DEFINITE: 'Xác định thời hạn',
      PROBATION: 'Thử việc',
      SEASONAL: 'Theo mùa vụ'
    };
    return labels[normalized] || trim_(value);
  }

  function employee(row, catalogs) {
    row = row || {};
    catalogs = catalogs || rawCatalogs_();
    var indexes = indexCatalogs_(catalogs);
    var department = indexes.departments[row.department_id] || {};
    var position = indexes.positions[row.position_id] || {};
    var condition = indexes.conditions[row.working_condition_id] || {};
    return {
      id: row.employee_id || row.id || null,
      employeeId: row.employee_id || row.id || null,
      code: row.employee_code || row.code || '',
      employeeCode: row.employee_code || row.code || '',
      fullName: row.full_name || row.fullName || '',
      gender: genderToClient_(row.gender),
      dob: row.date_of_birth || row.dob || '',
      dateOfBirth: row.date_of_birth || row.dateOfBirth || '',
      ethnicity: row.ethnicity || '',
      religion: row.religion || '',
      birthPlace: row.birth_place_current || row.birth_place_original || '',
      departmentId: row.department_id || null,
      department: row.department_name || department.name || '',
      positionId: row.position_id || null,
      position: row.position_name || position.name || '',
      workingConditionId: row.working_condition_id || null,
      workingCondition: row.working_condition_name || condition.name || '',
      joinDate: row.hire_date || '',
      hireDate: row.hire_date || '',
      officialDate: row.official_date || '',
      terminationDate: row.termination_date || '',
      contractType: contractTypeLabel_(row.contract_type_code),
      contractTypeCode: row.contract_type_code || '',
      contractNumber: row.contract_number || '',
      baseSalary: row.base_salary === null || row.base_salary === undefined ? '' : row.base_salary,
      allowance: row.allowance === null || row.allowance === undefined ? '' : row.allowance,
      jobDescription: row.job_description || '',
      education: row.education_level || '',
      educationLevel: row.education_level || '',
      major: row.major || '',
      leaveDays: row.leave_days === null || row.leave_days === undefined ? '' : row.leave_days,
      displayOrder: row.display_order === null || row.display_order === undefined
        ? null : Number(row.display_order),
      departmentDisplayOrder: row.department_display_order === null ||
        row.department_display_order === undefined
        ? null : Number(row.department_display_order),
      status: row.employment_status || row.status || 'DRAFT',
      statusEffectiveDate: row.status_effective_date || '',
      cccd: row.citizen_id || row.legacy_identity_number || '',
      citizenId: row.citizen_id || '',
      citizenIssuedDate: row.citizen_id_issued_date || '',
      citizenIssuedPlace: row.citizen_id_issued_place || '',
      bhxh: row.social_insurance_number || '',
      bhyt: row.health_insurance_number || '',
      insuranceStartDate: row.social_insurance_start_date || '',
      medicalPlace: row.medical_registration_place || '',
      permanentAddress: row.permanent_address || '',
      currentAddress: row.current_address || '',
      phone: row.phone || '',
      email: row.personal_email || row.work_email || '',
      workEmail: row.work_email || '',
      personalEmail: row.personal_email || '',
      emergencyContactName: row.emergency_contact_name || '',
      emergencyContactPhone: row.emergency_contact_phone || '',
      emergencyContactRelation: row.emergency_contact_relation || '',
      rowVersion: row.row_version === undefined ? null : row.row_version
    };
  }

  function employeeInput(payload, catalogs) {
    payload = payload || {};
    catalogs = catalogs || rawCatalogs_();
    var result = {
      employee_id: nullable_(payload.employeeId || payload.id),
      employee_code: nullable_(payload.employeeCode || payload.code),
      full_name: trim_(payload.fullName || payload.name),
      gender: genderToServer_(payload.gender),
      date_of_birth: nullable_(payload.dateOfBirth || payload.dob),
      ethnicity: nullable_(payload.ethnicity),
      religion: nullable_(payload.religion),
      birth_place_original: nullable_(payload.birthPlaceOriginal),
      birth_place_current: nullable_(payload.birthPlaceCurrent || payload.birthPlace),
      department_id: catalogId_(
        catalogs.departments,
        payload.departmentId,
        payload.department,
        'departmentId'
      ),
      position_id: catalogId_(
        catalogs.positions,
        payload.positionId,
        payload.position,
        'positionId'
      ),
      working_condition_id: catalogId_(
        catalogs.conditions,
        payload.workingConditionId,
        payload.workingCondition,
        'workingConditionId'
      ),
      hire_date: nullable_(payload.hireDate || payload.joinDate),
      official_date: nullable_(payload.officialDate),
      termination_date: nullable_(payload.terminationDate),
      contract_type_code: nullable_(payload.contractTypeCode || payload.contractType),
      base_salary: numberOrNull_(payload.baseSalary),
      allowance: numberOrNull_(payload.allowance),
      job_description: nullable_(payload.jobDescription),
      legacy_identity_number: nullable_(payload.legacyIdentityNumber),
      citizen_id: nullable_(payload.citizenId || payload.cccd),
      citizen_id_issued_date: nullable_(payload.citizenIdIssuedDate || payload.citizenIssuedDate),
      citizen_id_issued_place: nullable_(payload.citizenIdIssuedPlace || payload.citizenIssuedPlace),
      social_insurance_number: nullable_(payload.socialInsuranceNumber || payload.bhxh),
      health_insurance_number: nullable_(payload.healthInsuranceNumber || payload.bhyt),
      permanent_address: nullable_(payload.permanentAddress),
      current_address: nullable_(payload.currentAddress),
      phone: nullable_(payload.phone),
      work_email: nullable_(payload.workEmail),
      personal_email: nullable_(payload.personalEmail || payload.email),
      emergency_contact_name: nullable_(payload.emergencyContactName),
      emergency_contact_phone: nullable_(payload.emergencyContactPhone),
      emergency_contact_relation: nullable_(payload.emergencyContactRelation),
      row_version: payload.rowVersion === undefined ? payload.row_version : payload.rowVersion
    };
    if (!result.employee_code && !result.employee_id) {
      result.employee_code = 'NV-' + Utilities.formatDate(
        new Date(),
        HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
        'yyMMdd'
      ) + '-' + HrCore.uuid().replace(/-/g, '').slice(0, 6).toUpperCase();
    }
    return result;
  }

  function catalog(item, kind) {
    item = item || {};
    var id = item.department_id || item.position_id || item.working_condition_id || item.id;
    return {
      id: id || null,
      kind: kind || '',
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      parentId: item.parent_department_id || null,
      sortOrder: item.sort_order || 0,
      status: item.catalog_status || item.status || 'ACTIVE',
      rowVersion: item.row_version === undefined ? null : item.row_version
    };
  }

  function catalogs(source) {
    source = source || rawCatalogs_();
    return {
      departments: (source.departments || []).map(function (item) {
        return catalog(item, 'DEPARTMENT');
      }),
      positions: (source.positions || []).map(function (item) {
        return catalog(item, 'POSITION');
      }),
      conditions: (source.conditions || source.working_conditions || []).map(function (item) {
        return catalog(item, 'WORKING_CONDITION');
      })
    };
  }

  function template(row, catalogsValue) {
    row = row || {};
    catalogsValue = catalogsValue || rawCatalogs_();
    var indexes = indexCatalogs_(catalogsValue);
    return {
      id: row.job_template_id || row.id || null,
      code: row.code || '',
      name: row.name || '',
      version: row.version || 1,
      departmentId: row.department_id || null,
      department: (indexes.departments[row.department_id] || {}).name || '',
      positionId: row.position_id || null,
      position: (indexes.positions[row.position_id] || {}).name || '',
      workingConditionId: row.working_condition_id || null,
      workingCondition: (indexes.conditions[row.working_condition_id] || {}).name || '',
      probationContractType: row.probation_contract_type || '',
      description: row.job_description || '',
      jobDescription: row.job_description || '',
      baseSalary: row.base_salary_amount === null || row.base_salary_amount === undefined
        ? '' : row.base_salary_amount,
      currency: row.currency || 'VND',
      salaryNote: row.salary_note_suffix || '',
      salaryNoteSuffix: row.salary_note_suffix || '',
      departmentRuleNote: row.department_rule_note || '',
      sortOrder: row.sort_order || 0,
      status: row.template_status || row.status || 'DRAFT',
      rowVersion: row.row_version === undefined ? null : row.row_version
    };
  }

  function templateInput(payload, catalogsValue) {
    payload = payload || {};
    catalogsValue = catalogsValue || rawCatalogs_();
    return {
      job_template_id: nullable_(payload.jobTemplateId || payload.id),
      code: nullable_(payload.code),
      name: nullable_(payload.name),
      version: payload.version === undefined ? undefined : Number(payload.version),
      department_id: catalogId_(catalogsValue.departments, payload.departmentId,
        payload.department, 'departmentId'),
      position_id: catalogId_(catalogsValue.positions, payload.positionId,
        payload.position, 'positionId'),
      working_condition_id: catalogId_(catalogsValue.conditions, payload.workingConditionId,
        payload.workingCondition, 'workingConditionId'),
      probation_contract_type: nullable_(payload.probationContractType) || 'Xác định thời hạn 02 tháng',
      job_description: nullable_(payload.jobDescription || payload.description),
      base_salary_amount: numberOrNull_(payload.baseSalary),
      currency: nullable_(payload.currency) || 'VND',
      salary_note_suffix: nullable_(payload.salaryNoteSuffix || payload.salaryNote),
      department_rule_note: nullable_(payload.departmentRuleNote),
      sort_order: payload.sortOrder === undefined ? 0 : Number(payload.sortOrder),
      effective_from: nullable_(payload.effectiveFrom),
      effective_until: nullable_(payload.effectiveUntil),
      row_version: payload.rowVersion === undefined ? payload.row_version : payload.rowVersion,
      requested_status: trim_(payload.status).toUpperCase() || 'DRAFT'
    };
  }

  function candidate(row, catalogsValue, documents) {
    row = row || {};
    catalogsValue = catalogsValue || rawCatalogs_();
    var indexes = indexCatalogs_(catalogsValue);
    var history = (documents || []).filter(function (item) {
      return (item.candidate_id || item.candidateId) === row.candidate_id;
    });
    history.sort(function (left, right) {
      return String(right.generated_at || '').localeCompare(String(left.generated_at || ''));
    });
    var latest = history[0] || null;
    return {
      id: row.candidate_id || row.id || null,
      candidateId: row.candidate_id || row.id || null,
      candidateCode: row.candidate_code || '',
      fullName: row.full_name || '',
      candidateTitle: row.candidate_title || '',
      gender: genderToClient_(row.gender),
      dateOfBirth: row.date_of_birth || '',
      birthPlace: row.birth_place || '',
      nationality: row.nationality || '',
      citizenId: row.citizen_id || '',
      citizenIdIssuedDate: row.citizen_id_issued_date || '',
      citizenIdIssuedPlace: row.citizen_id_issued_place || '',
      permanentAddress: row.permanent_address || '',
      phone: row.phone || '',
      email: row.email || '',
      departmentId: row.department_id || null,
      department: (indexes.departments[row.department_id] || {}).name || '',
      positionId: row.position_id || null,
      position: (indexes.positions[row.position_id] || {}).name || '',
      workingConditionId: row.working_condition_id || null,
      workingCondition: (indexes.conditions[row.working_condition_id] || {}).name || '',
      jobTemplateId: row.job_template_id || null,
      jobTemplateName: row.job_template_name || '',
      probationContractType: row.probation_contract_type || '',
      jobDescription: row.job_description || '',
      baseSalary: row.base_salary_amount === null || row.base_salary_amount === undefined
        ? '' : row.base_salary_amount,
      currency: row.currency || 'VND',
      salaryNote: row.salary_note_suffix || '',
      departmentRuleNote: row.department_rule_note || '',
      probationStartDate: row.probation_start_date || '',
      probationEndDate: row.probation_end_date || '',
      status: row.candidate_status || row.status || 'DRAFT',
      statusReason: row.status_reason || '',
      convertedEmployeeId: row.converted_employee_id || null,
      latestContract: latest ? {
        id: latest.generated_document_id,
        contractNo: latest.contract_no,
        status: latest.generation_status,
        hasDocx: !!latest.has_docx,
        hasPdf: !!latest.has_pdf
      } : null,
      rowVersion: row.row_version === undefined ? null : row.row_version
    };
  }

  function candidateInput(payload, catalogsValue) {
    payload = payload || {};
    catalogsValue = catalogsValue || rawCatalogs_();
    var result = {
      candidate_id: nullable_(payload.candidateId || payload.id),
      full_name: trim_(payload.fullName),
      candidate_title: nullable_(payload.candidateTitle),
      gender: genderToServer_(payload.gender),
      date_of_birth: nullable_(payload.dateOfBirth),
      birth_place: nullable_(payload.birthPlace),
      nationality: nullable_(payload.nationality),
      citizen_id: nullable_(payload.citizenId),
      citizen_id_issued_date: nullable_(payload.citizenIdIssuedDate),
      citizen_id_issued_place: nullable_(payload.citizenIdIssuedPlace),
      permanent_address: nullable_(payload.permanentAddress),
      phone: nullable_(payload.phone),
      email: nullable_(payload.email),
      department_id: catalogId_(catalogsValue.departments, payload.departmentId,
        payload.department, 'departmentId'),
      position_id: catalogId_(catalogsValue.positions, payload.positionId,
        payload.position, 'positionId'),
      working_condition_id: catalogId_(catalogsValue.conditions, payload.workingConditionId,
        payload.workingCondition, 'workingConditionId'),
      job_template_id: nullable_(payload.jobTemplateId),
      probation_contract_type: nullable_(payload.probationContractType),
      job_description: nullable_(payload.jobDescription || payload.description),
      base_salary_amount: numberOrNull_(payload.baseSalary),
      currency: nullable_(payload.currency) || 'VND',
      salary_note_suffix: nullable_(payload.salaryNoteSuffix || payload.salaryNote),
      department_rule_note: nullable_(payload.departmentRuleNote),
      probation_start_date: nullable_(payload.probationStartDate),
      probation_end_date: nullable_(payload.probationEndDate),
      row_version: payload.rowVersion === undefined ? payload.row_version : payload.rowVersion
    };
    if (trim_(payload.candidateCode)) result.candidate_code = trim_(payload.candidateCode);
    return result;
  }

  function movement(row) {
    row = row || {};
    return {
      id: row.movement_id || row.id || null,
      movementId: row.movement_id || row.id || null,
      employeeId: row.employee_id || null,
      employeeCode: row.employee_code || row.code || '',
      code: row.employee_code || row.code || '',
      employeeName: row.employee_name || row.full_name || '',
      fullName: row.employee_name || row.full_name || '',
      type: row.movement_type || row.type || '',
      movementType: row.movement_type || row.type || '',
      effectiveDate: row.effective_date || '',
      reason: row.reason || '',
      decisionNo: row.decision_number || '',
      decisionDate: row.decision_date || '',
      status: row.movement_status || row.status || 'DRAFT',
      actor: row.confirmed_by || row.updated_by || '',
      confirmedAt: row.confirmed_at || '',
      rowVersion: row.row_version === undefined ? null : row.row_version
    };
  }

  function movementInput(payload) {
    payload = payload || {};
    return {
      movement_id: nullable_(payload.movementId || payload.id),
      employee_id: nullable_(payload.employeeId),
      movement_type: trim_(payload.movementType || payload.type).toUpperCase(),
      effective_date: nullable_(payload.effectiveDate),
      reason: nullable_(payload.reason),
      decision_number: nullable_(payload.decisionNumber || payload.decisionNo),
      decision_date: nullable_(payload.decisionDate),
      to_department_id: nullable_(payload.toDepartmentId),
      to_position_id: nullable_(payload.toPositionId),
      to_working_condition_id: nullable_(payload.toWorkingConditionId),
      row_version: payload.rowVersion === undefined ? payload.row_version : payload.rowVersion
    };
  }

  function roster(row) {
    row = row || {};
    var start = row.period_start || row.as_of_date || '';
    var match = String(start).match(/^(\d{4})-(\d{2})/);
    return {
      id: row.roster_id || row.id || ('LIVE:' + start),
      periodStart: start,
      label: match ? 'T' + Number(match[2]) + '-' + match[1].slice(-2) : 'Tháng',
      employeeCount: Number(row.item_count === undefined ? row.active_count || 0 : row.item_count),
      movementCount: Number(row.movement_count || 0),
      status: row.roster_kind === 'BASELINE' ? 'BASELINE' : 'LIVE',
      asOfDate: row.as_of_date || null
    };
  }

  function overview(source) {
    source = source || {};
    var employees = source.counts && source.counts.employees || {};
    var movements = source.counts && source.counts.movements || {};
    var probation = source.counts && source.counts.probation || {};
    return {
      total: Number(employees.total === undefined ? source.totalEmployees || 0 : employees.total),
      active: Number(employees.active_as_of === undefined
        ? source.activeEmployees || 0 : employees.active_as_of),
      draft: Number(employees.draft || 0),
      inactive: Number(employees.inactive || 0),
      probation: Number(probation.total === undefined ? source.probationCandidates || 0 : probation.total),
      newHires: Number(movements.increase === undefined ? source.newHires || 0 : movements.increase),
      departures: Number(movements.decrease === undefined ? source.departures || 0 : movements.decrease),
      netMovement: Number(movements.net === undefined ? source.netMovement || 0 : movements.net),
      period: source.period || null,
      asOfDate: source.as_of_date || null
    };
  }

  function audit(row) {
    row = row || {};
    return {
      id: row.audit_id || null,
      time: row.occurred_at || '',
      actor: row.actor_display_name || row.actor_id || '',
      action: row.action || '',
      target: [row.entity_type, row.entity_id].filter(Boolean).join(' · '),
      result: row.result || ''
    };
  }

  return Object.freeze({
    rawCatalogs: rawCatalogs_,
    employee: employee,
    employeeInput: employeeInput,
    catalogs: catalogs,
    catalog: catalog,
    template: template,
    templateInput: templateInput,
    candidate: candidate,
    candidateInput: candidateInput,
    movement: movement,
    movementInput: movementInput,
    roster: roster,
    overview: overview,
    audit: audit
  });
})();

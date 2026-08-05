/**
 * Employee master service for the flattened Sheets MVP.
 *
 * Public API:
 *   HrEmployeeService.list(query)
 *   HrEmployeeService.search(keyword, department, status, query)
 *   HrEmployeeService.get(employeeId, options)
 *   HrEmployeeService.create(payload, options)
 *   HrEmployeeService.update(employeeId, patch, expectedRowVersion, options)
 *   HrEmployeeService.saveDraft(payload, options)
 *
 * Only DRAFT employees may be edited through this generic service. ACTIVE and
 * INACTIVE state changes must go through HrWorkforceService movements.
 */
var HrEmployeeService = (function () {
  'use strict';

  var TABLE_ = null;
  var EDITABLE_FIELDS_ = [
    'employee_code', 'full_name', 'gender', 'date_of_birth',
    'ethnicity', 'religion', 'birth_place_original', 'birth_place_current',
    'department_id', 'position_id', 'working_condition_id',
    'hire_date', 'leave_accrual_start_date', 'official_date', 'termination_date',
    'contract_type_code', 'base_salary', 'allowance', 'job_description',
    'legacy_identity_number', 'citizen_id', 'citizen_id_issued_date',
    'citizen_id_issued_place', 'identity_verification_status',
    'social_insurance_number', 'health_insurance_number', 'insurance_status',
    'permanent_address', 'current_address', 'phone', 'work_email',
    'personal_email', 'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relation'
  ];
  var CREATE_ONLY_SOURCE_FIELDS_ = ['legacy_system', 'legacy_id', 'source_hash'];

  function fail_(code, message, details) {
    if (typeof HrCore !== 'undefined' && typeof HrCore.error === 'function') {
      throw HrCore.error(code, message, details || null);
    }
    var error = new Error(message);
    error.code = code;
    error.details = details || null;
    throw error;
  }

  function assert_(condition, code, message, details) {
    if (!condition) fail_(code, message, details);
  }

  function bootstrap_() {
    HrSheetStore.bootstrap();
    TABLE_ = TABLE_ || HrSchema.TABLES.EMPLOYEES;
    assert_(TABLE_, 'EMPLOYEE_SCHEMA_MISSING', 'Chưa cấu hình bảng nhân sự.');
  }

  function context_(options) {
    options = options || {};
    return options.context || HrCore.context(options.requestId);
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function all_(table) {
    return rows_(HrSheetStore.list(table));
  }

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

  function code_(value) {
    return trim_(value).toUpperCase().replace(/\s+/g, '');
  }

  function generatedEmployeeCode_() {
    var timestamp = Utilities.formatDate(
      new Date(),
      HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
      'yyMMddHHmmss'
    );
    return 'NV-' + timestamp + '-' +
      HrCore.uuid().replace(/-/g, '').slice(0, 4).toUpperCase();
  }

  function date_(value, field, required) {
    if (value === null || value === undefined || value === '') {
      assert_(!required, 'EMPLOYEE_DATE_REQUIRED', 'Thiếu ngày bắt buộc.', { field: field });
      return null;
    }
    var text;
    if (Object.prototype.toString.call(value) === '[object Date]') {
      text = Utilities.formatDate(value, HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'), 'yyyy-MM-dd');
    } else {
      text = trim_(value);
    }
    assert_(/^\d{4}-\d{2}-\d{2}$/.test(text), 'EMPLOYEE_DATE_INVALID', 'Ngày phải có định dạng yyyy-MM-dd.', {
      field: field
    });
    var parsed = new Date(text + 'T00:00:00Z');
    assert_(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text,
      'EMPLOYEE_DATE_INVALID',
      'Ngày không hợp lệ.',
      { field: field });
    return text;
  }

  function money_(value, field) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = Number(value);
    assert_(isFinite(parsed) && parsed >= 0, 'EMPLOYEE_MONEY_INVALID', 'Giá trị tiền không hợp lệ.', {
      field: field
    });
    return Math.round(parsed * 100) / 100;
  }

  function enum_(value, allowed, field, fallback) {
    var normalized = trim_(value || fallback).toUpperCase();
    assert_(allowed.indexOf(normalized) >= 0, 'EMPLOYEE_ENUM_INVALID', 'Giá trị danh mục không hợp lệ.', {
      field: field
    });
    return normalized;
  }

  function validateEmail_(value, field) {
    if (!value) return;
    assert_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'EMPLOYEE_EMAIL_INVALID',
      'Email không hợp lệ.',
      { field: field });
  }

  function validateEmployeeCode_(value) {
    assert_(value, 'EMPLOYEE_CODE_REQUIRED', 'Mã nhân sự là bắt buộc.');
    assert_(/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(value),
      'EMPLOYEE_CODE_INVALID',
      'Mã nhân sự không hợp lệ.');
  }

  function ensureUniqueCode_(value, excludeId) {
    all_(TABLE_).forEach(function (row) {
      if (excludeId && row.employee_id === excludeId) return;
      if (row.record_status !== 'DELETED' && code_(row.employee_code) === value) {
        fail_('EMPLOYEE_CODE_DUPLICATE', 'Mã nhân sự đã tồn tại.');
      }
    });
  }

  function catalogInfo_(field) {
    if (field === 'department_id') {
      return { table: HrSchema.TABLES.DEPARTMENTS, id: 'department_id' };
    }
    if (field === 'position_id') {
      return { table: HrSchema.TABLES.POSITIONS, id: 'position_id' };
    }
    return { table: HrSchema.TABLES.WORKING_CONDITIONS, id: 'working_condition_id' };
  }

  function validateCatalogRef_(field, id) {
    if (!id) return;
    var info = catalogInfo_(field);
    assert_(info.table, 'EMPLOYEE_CATALOG_SCHEMA_MISSING', 'Chưa cấu hình bảng danh mục.');
    var record = HrSheetStore.get(info.table, id);
    assert_(record && record.catalog_status === 'ACTIVE' && record.record_status !== 'DELETED',
      'EMPLOYEE_CATALOG_NOT_ACTIVE',
      'Danh mục tham chiếu không tồn tại hoặc đã ngừng sử dụng.',
      { field: field });
  }

  function sanitizeInput_(payload, current) {
    payload = payload || {};
    var result = {};
    EDITABLE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined) result[field] = payload[field];
    });

    if (!current || result.employee_code !== undefined) {
      result.employee_code = code_(
        result.employee_code === undefined
          ? (current && current.employee_code) || generatedEmployeeCode_()
          : (result.employee_code || (!current ? generatedEmployeeCode_() : ''))
      );
      validateEmployeeCode_(result.employee_code);
    }
    if (!current || result.full_name !== undefined) {
      result.full_name = trim_(result.full_name === undefined ? current && current.full_name : result.full_name);
      assert_(result.full_name, 'EMPLOYEE_NAME_REQUIRED', 'Họ tên nhân sự là bắt buộc.');
      assert_(result.full_name.length <= 255, 'EMPLOYEE_NAME_TOO_LONG', 'Họ tên vượt quá 255 ký tự.');
    }
    if (!current || result.gender !== undefined) {
      result.gender = enum_(
        result.gender === undefined ? current && current.gender : result.gender,
        ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'],
        'gender',
        'UNKNOWN'
      );
    }

    ['date_of_birth', 'hire_date', 'leave_accrual_start_date', 'official_date', 'termination_date',
      'citizen_id_issued_date'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = date_(result[field], field, false);
    });
    ['base_salary', 'allowance'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = money_(result[field], field);
    });

    ['department_id', 'position_id', 'working_condition_id'].forEach(function (field) {
      if (result[field] !== undefined) {
        result[field] = trim_(result[field]) || null;
        validateCatalogRef_(field, result[field]);
      }
    });

    ['work_email', 'personal_email'].forEach(function (field) {
      if (result[field] !== undefined) {
        result[field] = trim_(result[field]).toLowerCase() || null;
        validateEmail_(result[field], field);
      }
    });

    ['citizen_id', 'legacy_identity_number', 'social_insurance_number',
      'health_insurance_number', 'phone', 'emergency_contact_phone'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = trim_(result[field]) || null;
    });

    if (result.hire_date && result.official_date) {
      assert_(result.official_date >= result.hire_date,
        'EMPLOYEE_DATE_ORDER_INVALID',
        'Ngày chính thức không được trước ngày vào làm.');
    }
    if (result.hire_date && result.termination_date) {
      assert_(result.termination_date >= result.hire_date,
        'EMPLOYEE_DATE_ORDER_INVALID',
        'Ngày nghỉ việc không được trước ngày vào làm.');
    }
    return result;
  }

  function dataQualityWarnings_(record, excludeId) {
    var warnings = [];
    var citizen = trim_(record.citizen_id).replace(/\s+/g, '');
    var social = trim_(record.social_insurance_number).replace(/\s+/g, '');
    all_(TABLE_).forEach(function (row) {
      if (excludeId && row.employee_id === excludeId) return;
      if (row.record_status === 'DELETED') return;
      if (citizen && trim_(row.citizen_id).replace(/\s+/g, '') === citizen) {
        warnings.push({ code: 'CITIZEN_ID_REVIEW_REQUIRED', severity: 'WARNING' });
      }
      if (social && trim_(row.social_insurance_number).replace(/\s+/g, '') === social) {
        warnings.push({ code: 'SOCIAL_INSURANCE_REVIEW_REQUIRED', severity: 'WARNING' });
      }
    });
    var unique = {};
    return warnings.filter(function (warning) {
      if (unique[warning.code]) return false;
      unique[warning.code] = true;
      return true;
    });
  }

  function catalogMaps_() {
    function map_(table, idField) {
      var result = {};
      if (!table) return result;
      all_(table).forEach(function (row) {
        result[row[idField]] = { code: row.code, name: row.name, status: row.catalog_status };
      });
      return result;
    }
    return {
      departments: map_(HrSchema.TABLES.DEPARTMENTS, 'department_id'),
      positions: map_(HrSchema.TABLES.POSITIONS, 'position_id'),
      conditions: map_(HrSchema.TABLES.WORKING_CONDITIONS, 'working_condition_id')
    };
  }

  function project_(row, maps, includeSensitive) {
    var department = maps.departments[row.department_id] || null;
    var position = maps.positions[row.position_id] || null;
    var condition = maps.conditions[row.working_condition_id] || null;
    var result = {
      employee_id: row.employee_id,
      employee_code: row.employee_code,
      full_name: row.full_name,
      gender: row.gender,
      employment_status: row.employment_status,
      status_effective_date: row.status_effective_date,
      department_id: row.department_id || null,
      department_code: department && department.code,
      department_name: department && department.name,
      position_id: row.position_id || null,
      position_code: position && position.code,
      position_name: position && position.name,
      working_condition_id: row.working_condition_id || null,
      working_condition_name: condition && condition.name,
      hire_date: row.hire_date || null,
      leave_accrual_start_date: row.leave_accrual_start_date || null,
      row_version: row.row_version,
      record_status: row.record_status
    };
    if (includeSensitive) {
      EDITABLE_FIELDS_.forEach(function (field) {
        if (row[field] !== undefined) result[field] = row[field];
      });
      CREATE_ONLY_SOURCE_FIELDS_.forEach(function (field) {
        if (row[field] !== undefined) result[field] = row[field];
      });
    }
    return result;
  }

  function paginate_(items, query) {
    query = query || {};
    var maxSize = Number(HrConfig.get('MAX_PAGE_SIZE', 100)) || 100;
    var pageSize = Math.min(Math.max(Number(query.pageSize || query.limit || 25), 1), maxSize);
    var page = Math.max(Number(query.page || 1), 1);
    var offset = query.offset === undefined ? (page - 1) * pageSize : Math.max(Number(query.offset), 0);
    return {
      items: items.slice(offset, offset + pageSize),
      total: items.length,
      page: Math.floor(offset / pageSize) + 1,
      pageSize: pageSize,
      totalPages: Math.ceil(items.length / pageSize)
    };
  }

  function list(query) {
    bootstrap_();
    query = query || {};
    var keyword = normalize_(query.keyword);
    var status = trim_(query.status).toUpperCase();
    var departmentFilter = normalize_(query.department_id || query.department);
    var positionFilter = normalize_(query.position_id || query.position);
    var conditionFilter = normalize_(query.working_condition_id || query.working_condition);
    var maps = catalogMaps_();

    var items = all_(TABLE_).filter(function (row) {
      if (row.record_status === 'DELETED') return false;
      if (status && status !== 'ALL' && String(row.employment_status || '').toUpperCase() !== status) return false;

      var department = maps.departments[row.department_id] || {};
      var position = maps.positions[row.position_id] || {};
      var condition = maps.conditions[row.working_condition_id] || {};
      if (departmentFilter && [
        normalize_(row.department_id), normalize_(department.code), normalize_(department.name)
      ].indexOf(departmentFilter) < 0) return false;
      if (positionFilter && [
        normalize_(row.position_id), normalize_(position.code), normalize_(position.name)
      ].indexOf(positionFilter) < 0) return false;
      if (conditionFilter && [
        normalize_(row.working_condition_id), normalize_(condition.code), normalize_(condition.name)
      ].indexOf(conditionFilter) < 0) return false;
      if (keyword && normalize_([
        row.employee_code, row.full_name, department.name, position.name, condition.name
      ].join(' ')).indexOf(keyword) < 0) return false;
      return true;
    }).map(function (row) {
      return project_(row, maps, false);
    });

    var sortBy = trim_(query.sortBy || 'employee_code');
    var allowedSort = [
      'employee_code', 'full_name', 'employment_status', 'hire_date',
      'department_name', 'position_name'
    ];
    if (allowedSort.indexOf(sortBy) < 0) sortBy = 'employee_code';
    var direction = String(query.sortDirection || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
    items.sort(function (left, right) {
      return normalize_(left[sortBy]).localeCompare(normalize_(right[sortBy])) * direction;
    });
    return paginate_(items, query);
  }

  function search(keyword, department, status, query) {
    query = query || {};
    var merged = {};
    Object.keys(query).forEach(function (key) { merged[key] = query[key]; });
    merged.keyword = keyword;
    merged.department = department;
    merged.status = status;
    return list(merged);
  }

  function get(employeeId, options) {
    bootstrap_();
    options = options || {};
    assert_(trim_(employeeId), 'EMPLOYEE_ID_REQUIRED', 'ID nhân sự là bắt buộc.');
    var row = HrSheetStore.get(TABLE_, employeeId);
    assert_(row && row.record_status !== 'DELETED', 'EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân sự.');
    return project_(row, catalogMaps_(), options.includeSensitive !== false);
  }

  function auditView_(row) {
    if (!row) return null;
    return {
      employee_id: row.employee_id,
      employment_status: row.employment_status,
      department_id: row.department_id || null,
      position_id: row.position_id || null,
      working_condition_id: row.working_condition_id || null,
      row_version: row.row_version
    };
  }

  function audit_(action, before, after, context, changedFields) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'EMPLOYEE',
      entityId: (after || before).employee_id,
      before: auditView_(before),
      after: auditView_(after),
      context: context,
      metadata: { changed_fields: changedFields || [] }
    });
  }

  function create(payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var context = context_(options);
    var id = HrCore.uuid();
    var record = sanitizeInput_(payload, null);
    record.employee_id = id;
    record.employment_status = 'DRAFT';
    record.status_effective_date = date_(payload.status_effective_date, 'status_effective_date', false);
    record.record_status = 'ACTIVE';
    CREATE_ONLY_SOURCE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        record[field] = trim_(payload[field]);
      }
    });

    ensureUniqueCode_(record.employee_code, null);
    var warnings = dataQualityWarnings_(record, null);
    var key = options.idempotencyKey || payload.idempotency_key ||
      ['EMPLOYEE_CREATE', record.employee_code].join(':');
    return HrSheetStore.withIdempotency('EMPLOYEE_CREATE', key, function () {
      ensureUniqueCode_(record.employee_code, null);
      var created = HrSheetStore.insert(TABLE_, record, { context: context });
      audit_('EMPLOYEE_DRAFT_CREATED', null, created, context, Object.keys(record));
      return { employee: project_(created, catalogMaps_(), true), warnings: warnings };
    }, {
      aggregateType: 'EMPLOYEE',
      aggregateId: id,
      context: context,
      replayResolver: function (employeeId) {
        var replayed = employeeId && HrSheetStore.get(TABLE_, employeeId);
        return replayed
          ? { employee: project_(replayed, catalogMaps_(), true), warnings: [] }
          : null;
      }
    });
  }

  function update(employeeId, patch, expectedRowVersion, options) {
    bootstrap_();
    patch = patch || {};
    options = options || {};
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để cập nhật nhân sự.');
    var current = HrSheetStore.get(TABLE_, employeeId);
    assert_(current && current.record_status !== 'DELETED', 'EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân sự.');
    assert_(current.employment_status === 'DRAFT',
      'EMPLOYEE_NOT_DRAFT',
      'Chỉ hồ sơ DRAFT được sửa trực tiếp; thay đổi trạng thái phải qua biến động.');

    var normalized = sanitizeInput_(patch, current);
    if (normalized.employee_code !== undefined) ensureUniqueCode_(normalized.employee_code, employeeId);
    var changed = {};
    Object.keys(normalized).forEach(function (field) {
      if (normalized[field] !== current[field]) changed[field] = normalized[field];
    });
    if (!Object.keys(changed).length) {
      return { employee: project_(current, catalogMaps_(), true), warnings: dataQualityWarnings_(current, employeeId) };
    }

    var context = context_(options);
    var updated = HrSheetStore.update(TABLE_, employeeId, changed, expectedRowVersion, { context: context });
    audit_('EMPLOYEE_DRAFT_UPDATED', current, updated, context, Object.keys(changed));
    return {
      employee: project_(updated, catalogMaps_(), true),
      warnings: dataQualityWarnings_(updated, employeeId)
    };
  }

  function saveDraft(payload, options) {
    payload = payload || {};
    options = options || {};
    var id = payload.employee_id || payload.id || null;
    if (!id) return create(payload, options);
    var expectedVersion = options.expectedRowVersion;
    if (expectedVersion === undefined) expectedVersion = payload.row_version;
    return update(id, payload, expectedVersion, options);
  }

  return Object.freeze({
    list: list,
    search: search,
    get: get,
    create: create,
    update: update,
    saveDraft: saveDraft
  });
})();

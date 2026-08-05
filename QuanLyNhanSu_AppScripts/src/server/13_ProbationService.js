/**
 * Probation job-template and candidate workflow service.
 *
 * Public API:
 *   HrProbationService.listJobTemplates(query)
 *   HrProbationService.getJobTemplate(id)
 *   HrProbationService.saveJobTemplate(payload, options)
 *   HrProbationService.activateJobTemplate(id, expectedVersion, options)
 *   HrProbationService.inactivateJobTemplate(id, expectedVersion, options)
 *   HrProbationService.listCandidates(query)
 *   HrProbationService.getCandidate(id)
 *   HrProbationService.saveCandidate(payload, options)
 *   HrProbationService.runAction(candidateId, action, payload, options)
 *   HrProbationService.markContractCreated(candidateId, documentId, expectedVersion, options)
 *
 * Job presets are authoritative snapshots. Client values cannot override a
 * selected ACTIVE preset's contract, job, salary or rule fields.
 */
var HrProbationService = (function () {
  'use strict';

  var TEMPLATES_ = null;
  var CANDIDATES_ = null;
  var EMPLOYEES_ = null;
  var TEMPLATE_FIELDS_ = [
    'code', 'name', 'version', 'department_id', 'position_id',
    'working_condition_id', 'probation_contract_type', 'job_description',
    'base_salary_amount', 'currency', 'salary_note_suffix',
    'department_rule_note', 'sort_order', 'effective_from', 'effective_until',
    'replaces_version'
  ];
  var CANDIDATE_FIELDS_ = [
    'candidate_code', 'full_name', 'candidate_title', 'gender',
    'date_of_birth', 'birth_place', 'nationality', 'citizen_id',
    'citizen_id_issued_date', 'citizen_id_issued_place', 'permanent_address',
    'phone', 'email', 'department_id', 'position_id', 'working_condition_id',
    'job_template_id', 'probation_contract_type', 'job_description',
    'base_salary_amount', 'currency', 'salary_note_suffix',
    'department_rule_note', 'probation_start_date', 'probation_end_date'
  ];
  var SOURCE_FIELDS_ = ['legacy_system', 'legacy_id', 'source_hash'];

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
    TEMPLATES_ = TEMPLATES_ || HrSchema.TABLES.PROBATION_JOB_TEMPLATES;
    CANDIDATES_ = CANDIDATES_ || HrSchema.TABLES.PROBATION_CANDIDATES;
    EMPLOYEES_ = EMPLOYEES_ || HrSchema.TABLES.EMPLOYEES;
    assert_(TEMPLATES_ && CANDIDATES_ && EMPLOYEES_,
      'PROBATION_SCHEMA_MISSING',
      'Chưa cấu hình bảng thử việc.');
  }

  function activeSpreadsheet_() {
    return HrConfig.openSpreadsheet();
  }

  function context_(options) {
    options = options || {};
    return options.context || HrCore.context(options.requestId);
  }

  function actor_(context) {
    return context && (
      context.actorId || context.actor_id ||
      (context.actor && context.actor.id)
    ) || null;
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
    return trim_(value).toUpperCase().replace(/\s+/g, '-');
  }

  function date_(value, field, required) {
    if (value === null || value === undefined || value === '') {
      assert_(!required, 'PROBATION_DATE_REQUIRED', 'Thiếu ngày bắt buộc.', { field: field });
      return null;
    }
    var text = Object.prototype.toString.call(value) === '[object Date]'
      ? Utilities.formatDate(value, HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'), 'yyyy-MM-dd')
      : trim_(value);
    assert_(/^\d{4}-\d{2}-\d{2}$/.test(text),
      'PROBATION_DATE_INVALID',
      'Ngày phải có định dạng yyyy-MM-dd.',
      { field: field });
    var parsed = new Date(text + 'T00:00:00Z');
    assert_(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text,
      'PROBATION_DATE_INVALID',
      'Ngày không hợp lệ.',
      { field: field });
    return text;
  }

  function plusDays_(isoDate, days) {
    if (!isoDate) return null;
    var value = new Date(isoDate + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  function number_(value, field, fallback, integerOnly) {
    if (value === null || value === undefined || value === '') return fallback;
    var parsed = Number(value);
    assert_(isFinite(parsed) && parsed >= 0,
      'PROBATION_NUMBER_INVALID',
      'Giá trị số không hợp lệ.',
      { field: field });
    if (integerOnly) parsed = Math.trunc(parsed);
    return parsed;
  }

  function salarySuffix_(value) {
    var suffix = trim_(value);
    suffix = suffix.replace(/^đồng\s*\/\s*tháng/i, '');
    if (!suffix) return null;
    return /^\s/.test(suffix) ? suffix : ' ' + suffix;
  }

  function safeCodeFromName_(value, fallback) {
    var normalized = code_(value || fallback || 'TEMPLATE');
    normalized = normalized
      .replace(/[^A-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback || 'TEMPLATE';
  }

  function sheetValues_(name) {
    var sheet = activeSpreadsheet_().getSheetByName(name);
    if (!sheet) return null;
    var values = sheet.getDataRange().getValues();
    return values && values.length ? values : null;
  }

  function toText_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function rowObject_(headers, row) {
    var result = {};
    headers.forEach(function (header, index) {
      result[header] = row[index];
    });
    return result;
  }

  function legacyStatus_(value) {
    var normalized = toText_(value).toUpperCase();
    if (normalized === 'ACTIVE' || normalized === 'INACTIVE' || normalized === 'DRAFT') {
      return normalized;
    }
    return 'DRAFT';
  }

  function catalogIdByName_(tableName, fieldName, name) {
    var wanted = normalize_(name);
    if (!wanted || wanted === '(chung)') return null;
    var rows = all_(tableName).filter(function (row) {
      return row.record_status !== 'DELETED' &&
        row.catalog_status === 'ACTIVE' &&
        normalize_(row.name) === wanted;
    });
    return rows[0] ? rows[0][fieldName] : null;
  }

  function ensureLegacyTemplatesImported_() {
    var existing = all_(TEMPLATES_).filter(function (row) {
      return row.record_status !== 'DELETED';
    });
    if (existing.length) return;

    var values = sheetValues_('Job_Templates');
    if (!values || values.length < 2) return;

    var headers = values[0].map(function (value) { return toText_(value); });
    var required = ['Mã Mẫu', 'Tên Mẫu Công Việc', 'Phòng Ban', 'Mô Tả Công Việc', 'Lương (VNĐ)', 'Ghi Chú Lương', 'Loại Hợp Đồng', 'Nội Quy', 'Trạng Thái', 'Thứ Tự'];
    var hasStructure = required.every(function (key) { return headers.indexOf(key) >= 0; });
    if (!hasStructure) return;

    HrSheetStore.withLock(function () {
      var current = all_(TEMPLATES_).filter(function (row) { return row.record_status !== 'DELETED'; });
      if (current.length) return;

      var context = HrCore.context();
      values.slice(1).forEach(function (row, index) {
        var item = rowObject_(headers, row);
        var codeValue = safeCodeFromName_(item['Mã Mẫu'], 'TEMPLATE-' + (index + 1));
        var nameValue = toText_(item['Tên Mẫu Công Việc']);
        if (!codeValue || !nameValue) return;

        var departmentId = catalogIdByName_(
          HrSchema.TABLES.DEPARTMENTS,
          'department_id',
          item['Phòng Ban']
        );
        var sortOrder = number_(item['Thứ Tự'], 'sort_order', index + 1, true);
        var baseSalary = number_(item['Lương (VNĐ)'], 'base_salary_amount', null, false);
        var templateRecord = {
          job_template_id: HrCore.uuid(),
          code: codeValue,
          name: nameValue,
          version: 1,
          department_id: departmentId,
          position_id: null,
          working_condition_id: null,
          probation_contract_type: toText_(item['Loại Hợp Đồng']) || 'Xác định thời hạn 02 tháng',
          job_description: toText_(item['Mô Tả Công Việc']) || null,
          base_salary_amount: baseSalary,
          currency: 'VND',
          salary_note_suffix: salarySuffix_(item['Ghi Chú Lương']),
          department_rule_note: toText_(item['Nội Quy']) || null,
          sort_order: sortOrder,
          template_status: legacyStatus_(item['Trạng Thái']),
          effective_from: null,
          effective_until: null,
          replaces_version: null,
          record_status: 'ACTIVE',
          legacy_system: 'JOB_TEMPLATES_SHEET',
          legacy_id: toText_(item['STT']) || String(index + 1)
        };
        templateRecord.content_sha256 = contentHash_(templateRecord);
        HrSheetStore.insert(TEMPLATES_, templateRecord, { context: context });
      });
    }, Number(HrConfig.get('LOCK_TIMEOUT_MS', 5000)));
  }

  function validateCode_(value, field) {
    assert_(value, 'PROBATION_CODE_REQUIRED', 'Mã là bắt buộc.', { field: field });
    assert_(/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(value),
      'PROBATION_CODE_INVALID',
      'Mã không hợp lệ.',
      { field: field });
  }

  function validateCatalog_(field, id) {
    if (!id) return null;
    var mapping = {
      department_id: { table: HrSchema.TABLES.DEPARTMENTS },
      position_id: { table: HrSchema.TABLES.POSITIONS },
      working_condition_id: { table: HrSchema.TABLES.WORKING_CONDITIONS }
    };
    var info = mapping[field];
    var row = info && info.table && HrSheetStore.get(info.table, id);
    assert_(row && row.catalog_status === 'ACTIVE' && row.record_status !== 'DELETED',
      'PROBATION_CATALOG_NOT_ACTIVE',
      'Danh mục tham chiếu không tồn tại hoặc đã ngừng sử dụng.',
      { field: field });
    return id;
  }

  function ensureTemplateUnique_(codeValue, version, excludeId) {
    all_(TEMPLATES_).forEach(function (row) {
      if (excludeId && row.job_template_id === excludeId) return;
      if (row.record_status !== 'DELETED' &&
          code_(row.code) === codeValue &&
          Number(row.version) === Number(version)) {
        fail_('JOB_TEMPLATE_VERSION_DUPLICATE', 'Mã và phiên bản mẫu công việc đã tồn tại.');
      }
    });
  }

  function ensureCandidateCodeUnique_(candidateCode, excludeId) {
    all_(CANDIDATES_).forEach(function (row) {
      if (excludeId && row.candidate_id === excludeId) return;
      if (row.record_status !== 'DELETED' && code_(row.candidate_code) === candidateCode) {
        fail_('CANDIDATE_CODE_DUPLICATE', 'Mã ứng viên thử việc đã tồn tại.');
      }
    });
  }

  function contentHash_(record) {
    var content = {};
    [
      'code', 'name', 'version', 'department_id', 'position_id',
      'working_condition_id', 'probation_contract_type', 'job_description',
      'base_salary_amount', 'currency', 'salary_note_suffix',
      'department_rule_note', 'sort_order', 'effective_from', 'effective_until',
      'replaces_version'
    ].forEach(function (field) {
      content[field] = record[field] === undefined ? null : record[field];
    });
    return HrCore.sha256(HrCore.canonicalJson(content));
  }

  function normalizeTemplate_(payload, current) {
    payload = payload || {};
    var result = {};
    TEMPLATE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined) result[field] = payload[field];
    });
    if (!current || result.code !== undefined) {
      result.code = code_(result.code === undefined ? current && current.code : result.code);
      validateCode_(result.code, 'code');
    }
    if (!current || result.name !== undefined) {
      result.name = trim_(result.name === undefined ? current && current.name : result.name);
      assert_(result.name, 'JOB_TEMPLATE_NAME_REQUIRED', 'Tên mẫu công việc là bắt buộc.');
    }
    if (result.version !== undefined) {
      result.version = number_(result.version, 'version', 1, true);
      assert_(result.version >= 1, 'JOB_TEMPLATE_VERSION_INVALID', 'Phiên bản phải từ 1 trở lên.');
    }
    if (result.sort_order !== undefined) result.sort_order = number_(result.sort_order, 'sort_order', 0, true);
    if (result.base_salary_amount !== undefined) {
      result.base_salary_amount = number_(result.base_salary_amount, 'base_salary_amount', null, false);
    }
    if (result.currency !== undefined) result.currency = code_(result.currency || 'VND');
    if (result.salary_note_suffix !== undefined) result.salary_note_suffix = salarySuffix_(result.salary_note_suffix);
    ['effective_from', 'effective_until'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = date_(result[field], field, false);
    });
    ['department_id', 'position_id', 'working_condition_id'].forEach(function (field) {
      if (result[field] !== undefined) {
        result[field] = trim_(result[field]) || null;
        validateCatalog_(field, result[field]);
      }
    });
    if (result.effective_from && result.effective_until) {
      assert_(result.effective_until >= result.effective_from,
        'JOB_TEMPLATE_EFFECTIVE_RANGE_INVALID',
        'Ngày kết thúc hiệu lực không được trước ngày bắt đầu.');
    }
    ['probation_contract_type', 'job_description', 'department_rule_note'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = trim_(result[field]) || null;
    });
    return result;
  }

  function getJobTemplate(id) {
    bootstrap_();
    var row = HrSheetStore.get(TEMPLATES_, id);
    assert_(row && row.record_status !== 'DELETED', 'JOB_TEMPLATE_NOT_FOUND', 'Không tìm thấy mẫu công việc.');
    return row;
  }

  function listJobTemplates(query) {
    bootstrap_();
    ensureLegacyTemplatesImported_();
    query = query || {};
    var keyword = normalize_(query.keyword);
    var status = trim_(query.status || query.template_status).toUpperCase();
    var items = all_(TEMPLATES_).filter(function (row) {
      if (row.record_status === 'DELETED') return false;
      if (status && status !== 'ALL' && row.template_status !== status) return false;
      if (keyword && normalize_([row.code, row.name, row.job_description].join(' ')).indexOf(keyword) < 0) return false;
      return true;
    });
    items.sort(function (left, right) {
      var order = Number(left.sort_order || 0) - Number(right.sort_order || 0);
      if (order) return order;
      var codeOrder = String(left.code).localeCompare(String(right.code));
      if (codeOrder) return codeOrder;
      return Number(right.version || 0) - Number(left.version || 0);
    });
    return { items: items, total: items.length };
  }

  function auditTemplate_(action, before, after, context, changedFields) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'PROBATION_JOB_TEMPLATE',
      entityId: (after || before).job_template_id,
      before: before || null,
      after: after || null,
      context: context,
      metadata: { changed_fields: changedFields || [] }
    });
  }

  function createJobTemplate_(payload, options) {
    payload = payload || {};
    options = options || {};
    var normalized = normalizeTemplate_(payload, null);
    if (normalized.version === undefined) {
      var sameCode = all_(TEMPLATES_).filter(function (row) {
        return row.record_status !== 'DELETED' && code_(row.code) === normalized.code;
      });
      normalized.version = sameCode.reduce(function (max, row) {
        return Math.max(max, Number(row.version || 0));
      }, 0) + 1;
    }
    if (normalized.sort_order === undefined) normalized.sort_order = 0;
    if (normalized.currency === undefined) normalized.currency = 'VND';
    ensureTemplateUnique_(normalized.code, normalized.version, null);
    var id = HrCore.uuid();
    normalized.job_template_id = id;
    normalized.template_status = 'DRAFT';
    normalized.content_sha256 = contentHash_(normalized);
    normalized.record_status = 'ACTIVE';
    SOURCE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        normalized[field] = trim_(payload[field]);
      }
    });
    var context = context_(options);
    var key = options.idempotencyKey || payload.idempotency_key ||
      ['JOB_TEMPLATE', normalized.code, normalized.version].join(':');
    return HrSheetStore.withIdempotency('JOB_TEMPLATE_CREATE', key, function () {
      ensureTemplateUnique_(normalized.code, normalized.version, null);
      var created = HrSheetStore.insert(TEMPLATES_, normalized, { context: context });
      auditTemplate_('JOB_TEMPLATE_DRAFT_CREATED', null, created, context, Object.keys(normalized));
      return created;
    }, {
      aggregateType: 'PROBATION_JOB_TEMPLATE',
      aggregateId: id,
      context: context,
      replayResolver: function (templateId) {
        return templateId ? HrSheetStore.get(TEMPLATES_, templateId) : null;
      }
    });
  }

  function updateJobTemplate_(id, patch, expectedVersion, options) {
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để cập nhật mẫu công việc.');
    var current = getJobTemplate(id);
    assert_(current.template_status === 'DRAFT',
      'JOB_TEMPLATE_IMMUTABLE',
      'Chỉ mẫu công việc DRAFT được sửa; thay đổi mẫu đã dùng phải tạo phiên bản mới.');
    var normalized = normalizeTemplate_(patch, current);
    var merged = {};
    Object.keys(current).forEach(function (field) { merged[field] = current[field]; });
    Object.keys(normalized).forEach(function (field) { merged[field] = normalized[field]; });
    ensureTemplateUnique_(merged.code, merged.version, id);
    normalized.content_sha256 = contentHash_(merged);
    var changed = {};
    Object.keys(normalized).forEach(function (field) {
      if (normalized[field] !== current[field]) changed[field] = normalized[field];
    });
    if (!Object.keys(changed).length) return current;
    var context = context_(options);
    var updated = HrSheetStore.update(TEMPLATES_, id, changed, expectedVersion, { context: context });
    auditTemplate_('JOB_TEMPLATE_DRAFT_UPDATED', current, updated, context, Object.keys(changed));
    return updated;
  }

  function saveJobTemplate(payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var id = payload.job_template_id || payload.id || null;
    if (!id) return createJobTemplate_(payload, options);
    var expected = options.expectedRowVersion;
    if (expected === undefined) expected = payload.row_version;
    return updateJobTemplate_(id, payload, expected, options);
  }

  function validateTemplateForActivation_(row) {
    [
      'code', 'name', 'probation_contract_type', 'job_description',
      'base_salary_amount', 'department_rule_note', 'content_sha256'
    ].forEach(function (field) {
      assert_(row[field] !== null && row[field] !== undefined && row[field] !== '',
        'JOB_TEMPLATE_ACTIVATION_INCOMPLETE',
        'Mẫu công việc chưa đủ dữ liệu để kích hoạt.',
        { field: field });
    });
    assert_(row.content_sha256 === contentHash_(row),
      'JOB_TEMPLATE_HASH_MISMATCH',
      'Checksum mẫu công việc không khớp nội dung hiện tại.');
  }

  function activateJobTemplate(id, expectedVersion, options) {
    bootstrap_();
    options = options || {};
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để kích hoạt mẫu công việc.');
    var context = context_(options);
    return HrSheetStore.withLock(function () {
      var current = getJobTemplate(id);
      if (current.template_status === 'ACTIVE') return current;
      assert_(current.template_status === 'DRAFT',
        'JOB_TEMPLATE_ACTIVATION_STATUS_INVALID',
        'Chỉ mẫu DRAFT được kích hoạt.');
      assert_(Number(current.row_version) === Number(expectedVersion),
        'ROW_VERSION_CONFLICT',
        'Mẫu công việc đã được người khác cập nhật.');
      validateTemplateForActivation_(current);
      var activeConflict = all_(TEMPLATES_).some(function (row) {
        return row.job_template_id !== id &&
          row.record_status !== 'DELETED' &&
          row.template_status === 'ACTIVE' &&
          code_(row.code) === code_(current.code);
      });
      assert_(!activeConflict,
        'JOB_TEMPLATE_ACTIVE_VERSION_EXISTS',
        'Mã mẫu này đã có một phiên bản ACTIVE; hãy ngừng phiên bản cũ trước.');
      var updated = HrSheetStore.update(
        TEMPLATES_,
        id,
        { template_status: 'ACTIVE' },
        current.row_version,
        { context: context }
      );
      auditTemplate_('JOB_TEMPLATE_ACTIVATED', current, updated, context, ['template_status']);
      return updated;
    }, Number(HrConfig.get('LOCK_TIMEOUT_MS', 5000)));
  }

  function inactivateJobTemplate(id, expectedVersion, options) {
    bootstrap_();
    options = options || {};
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để ngừng mẫu công việc.');
    var current = getJobTemplate(id);
    if (current.template_status === 'INACTIVE') return current;
    assert_(current.template_status === 'ACTIVE' || current.template_status === 'DRAFT',
      'JOB_TEMPLATE_INACTIVATE_STATUS_INVALID',
      'Trạng thái mẫu công việc không hợp lệ.');
    var context = context_(options);
    var updated = HrSheetStore.update(
      TEMPLATES_,
      id,
      { template_status: 'INACTIVE' },
      expectedVersion,
      { context: context }
    );
    auditTemplate_('JOB_TEMPLATE_INACTIVATED', current, updated, context, ['template_status']);
    return updated;
  }

  function generatedCandidateCode_() {
    var timestamp = Utilities.formatDate(
      new Date(),
      HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
      'yyMMddHHmmss'
    );
    return 'TV-' + timestamp + '-' + HrCore.uuid().replace(/-/g, '').slice(0, 4).toUpperCase();
  }

  function normalizeCandidate_(payload, current) {
    payload = payload || {};
    var result = {};
    CANDIDATE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined) result[field] = payload[field];
    });
    if (!current || result.candidate_code !== undefined) {
      result.candidate_code = code_(
        result.candidate_code === undefined
          ? (current && current.candidate_code) || generatedCandidateCode_()
          : result.candidate_code
      );
      validateCode_(result.candidate_code, 'candidate_code');
    }
    if (!current || result.full_name !== undefined) {
      result.full_name = trim_(result.full_name === undefined ? current && current.full_name : result.full_name);
      assert_(result.full_name, 'CANDIDATE_NAME_REQUIRED', 'Họ tên ứng viên là bắt buộc.');
    }
    if (!current || result.gender !== undefined) {
      result.gender = trim_(result.gender === undefined ? current && current.gender : result.gender).toUpperCase() || 'UNKNOWN';
      assert_(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].indexOf(result.gender) >= 0,
        'CANDIDATE_GENDER_INVALID',
        'Giới tính ứng viên không hợp lệ.');
    }
    ['date_of_birth', 'citizen_id_issued_date', 'probation_start_date', 'probation_end_date'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = date_(result[field], field, false);
    });
    if (result.base_salary_amount !== undefined) {
      result.base_salary_amount = number_(result.base_salary_amount, 'base_salary_amount', null, false);
    }
    if (result.currency !== undefined) result.currency = code_(result.currency || 'VND');
    if (result.salary_note_suffix !== undefined) result.salary_note_suffix = salarySuffix_(result.salary_note_suffix);
    ['department_id', 'position_id', 'working_condition_id'].forEach(function (field) {
      if (result[field] !== undefined) {
        result[field] = trim_(result[field]) || null;
        validateCatalog_(field, result[field]);
      }
    });
    if (result.email !== undefined) {
      result.email = trim_(result.email).toLowerCase() || null;
      assert_(!result.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email),
        'CANDIDATE_EMAIL_INVALID',
        'Email ứng viên không hợp lệ.');
    }
    ['citizen_id', 'phone'].forEach(function (field) {
      if (result[field] !== undefined) result[field] = trim_(result[field]) || null;
    });
    [
      'candidate_title', 'birth_place', 'nationality', 'citizen_id_issued_place',
      'permanent_address', 'probation_contract_type', 'job_description',
      'department_rule_note'
    ].forEach(function (field) {
      if (result[field] !== undefined) result[field] = trim_(result[field]) || null;
    });
    if (result.probation_start_date && result.probation_end_date) {
      assert_(result.probation_end_date >= result.probation_start_date,
        'CANDIDATE_PROBATION_RANGE_INVALID',
        'Ngày kết thúc thử việc không được trước ngày bắt đầu.');
    }
    return result;
  }

  function applyTemplateSnapshot_(candidate, templateId) {
    if (!templateId) return candidate;
    var template = getJobTemplate(templateId);
    assert_(template.template_status === 'ACTIVE',
      'JOB_TEMPLATE_NOT_ACTIVE',
      'Chỉ được chọn mẫu công việc ACTIVE.');
    candidate.job_template_id = template.job_template_id;
    [
      'department_id', 'position_id', 'working_condition_id',
      'probation_contract_type', 'job_description', 'currency',
      'salary_note_suffix', 'department_rule_note'
    ].forEach(function (field) {
      candidate[field] = template[field] === undefined ? null : template[field];
    });
    candidate.base_salary_amount = template.base_salary_amount;
    return candidate;
  }

  function getCandidate(id) {
    bootstrap_();
    var row = HrSheetStore.get(CANDIDATES_, id);
    assert_(row && row.record_status !== 'DELETED', 'CANDIDATE_NOT_FOUND', 'Không tìm thấy ứng viên thử việc.');
    return row;
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

  function listCandidates(query) {
    bootstrap_();
    query = query || {};
    var keyword = normalize_(query.keyword);
    var status = trim_(query.status || query.candidate_status).toUpperCase();
    var departmentId = trim_(query.department_id);
    var templateMap = {};
    all_(TEMPLATES_).forEach(function (template) { templateMap[template.job_template_id] = template; });
    var items = all_(CANDIDATES_).filter(function (row) {
      if (row.record_status === 'DELETED') return false;
      if (status && status !== 'ALL' && row.candidate_status !== status) return false;
      if (departmentId && row.department_id !== departmentId) return false;
      var template = templateMap[row.job_template_id] || {};
      if (keyword && normalize_([
        row.candidate_code, row.full_name, row.phone, row.email, template.name
      ].join(' ')).indexOf(keyword) < 0) return false;
      return true;
    }).map(function (row) {
      var result = {};
      Object.keys(row).forEach(function (field) { result[field] = row[field]; });
      var template = templateMap[row.job_template_id] || null;
      result.job_template_name = template && template.name;
      result.job_template_version = template && template.version;
      return result;
    });
    items.sort(function (left, right) {
      return String(right.updated_at || right.created_at || '').localeCompare(
        String(left.updated_at || left.created_at || '')
      );
    });
    return paginate_(items, query);
  }

  function auditCandidateView_(row) {
    if (!row) return null;
    return {
      candidate_id: row.candidate_id,
      candidate_status: row.candidate_status,
      job_template_id: row.job_template_id || null,
      department_id: row.department_id || null,
      position_id: row.position_id || null,
      converted_employee_id: row.converted_employee_id || null,
      row_version: row.row_version
    };
  }

  function auditCandidate_(action, before, after, context, metadata) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'PROBATION_CANDIDATE',
      entityId: (after || before).candidate_id,
      before: auditCandidateView_(before),
      after: auditCandidateView_(after),
      context: context,
      metadata: metadata || {}
    });
  }

  function createCandidate_(payload, options) {
    var normalized = normalizeCandidate_(payload, null);
    if (normalized.currency === undefined) normalized.currency = 'VND';
    normalized = applyTemplateSnapshot_(normalized, normalized.job_template_id);
    ensureCandidateCodeUnique_(normalized.candidate_code, null);
    var id = HrCore.uuid();
    normalized.candidate_id = id;
    normalized.candidate_status = 'DRAFT';
    normalized.record_status = 'ACTIVE';
    SOURCE_FIELDS_.forEach(function (field) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        normalized[field] = trim_(payload[field]);
      }
    });
    var context = context_(options);
    var key = options.idempotencyKey || payload.idempotency_key ||
      ['CANDIDATE', normalized.candidate_code].join(':');
    return HrSheetStore.withIdempotency('CANDIDATE_CREATE', key, function () {
      ensureCandidateCodeUnique_(normalized.candidate_code, null);
      var created = HrSheetStore.insert(CANDIDATES_, normalized, { context: context });
      auditCandidate_('CANDIDATE_DRAFT_CREATED', null, created, context, {
        changed_fields: Object.keys(normalized)
      });
      return created;
    }, {
      aggregateType: 'PROBATION_CANDIDATE',
      aggregateId: id,
      context: context,
      replayResolver: function (candidateId) {
        return candidateId ? HrSheetStore.get(CANDIDATES_, candidateId) : null;
      }
    });
  }

  function updateCandidate_(id, patch, expectedVersion, options) {
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để cập nhật ứng viên.');
    var current = getCandidate(id);
    assert_(current.candidate_status === 'DRAFT',
      'CANDIDATE_IMMUTABLE',
      'Chỉ ứng viên DRAFT được sửa trực tiếp.');
    var normalized = normalizeCandidate_(patch, current);
    if (normalized.candidate_code !== undefined) {
      ensureCandidateCodeUnique_(normalized.candidate_code, id);
    }
    if (patch.job_template_id !== undefined) {
      normalized = applyTemplateSnapshot_(normalized, trim_(patch.job_template_id) || null);
    }
    var merged = {};
    Object.keys(current).forEach(function (field) { merged[field] = current[field]; });
    Object.keys(normalized).forEach(function (field) { merged[field] = normalized[field]; });
    if (merged.probation_start_date && merged.probation_end_date) {
      assert_(merged.probation_end_date >= merged.probation_start_date,
        'CANDIDATE_PROBATION_RANGE_INVALID',
        'Ngày kết thúc thử việc không được trước ngày bắt đầu.');
    }
    var changed = {};
    Object.keys(normalized).forEach(function (field) {
      if (normalized[field] !== current[field]) changed[field] = normalized[field];
    });
    if (!Object.keys(changed).length) return current;
    var context = context_(options);
    var updated = HrSheetStore.update(CANDIDATES_, id, changed, expectedVersion, { context: context });
    auditCandidate_('CANDIDATE_DRAFT_UPDATED', current, updated, context, {
      changed_fields: Object.keys(changed)
    });
    return updated;
  }

  function saveCandidate(payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var id = payload.candidate_id || payload.id || null;
    if (!id) return createCandidate_(payload, options);
    var expected = options.expectedRowVersion;
    if (expected === undefined) expected = payload.row_version;
    return updateCandidate_(id, payload, expected, options);
  }

  function transitionCandidate_(id, targetStatus, expectedVersion, payload, options) {
    payload = payload || {};
    options = options || {};
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để đổi trạng thái ứng viên.');
    var current = getCandidate(id);
    if (current.candidate_status === targetStatus) return current;
    var allowed = {
      DRAFT: ['CONTRACT_CREATED', 'CANCELLED'],
      CONTRACT_CREATED: ['IN_PROBATION', 'CANCELLED'],
      IN_PROBATION: ['PASSED', 'FAILED', 'CANCELLED'],
      PASSED: ['CONVERTED'],
      FAILED: [],
      CONVERTED: [],
      CANCELLED: []
    };
    assert_((allowed[current.candidate_status] || []).indexOf(targetStatus) >= 0,
      'CANDIDATE_TRANSITION_INVALID',
      'Chuyển trạng thái ứng viên không hợp lệ.');
    var patch = { candidate_status: targetStatus };
    if (targetStatus === 'FAILED' || targetStatus === 'CANCELLED') {
      patch.status_reason = trim_(payload.reason || payload.status_reason);
      assert_(patch.status_reason,
        'CANDIDATE_STATUS_REASON_REQUIRED',
        'Trạng thái thất bại hoặc hủy bắt buộc có lý do.');
    } else {
      patch.status_reason = null;
    }
    if (targetStatus === 'IN_PROBATION') {
      assert_(current.probation_start_date && current.probation_end_date,
        'CANDIDATE_PROBATION_DATES_REQUIRED',
        'Thiếu thời gian thử việc.');
    }
    var context = context_(options);
    var updated = HrSheetStore.update(CANDIDATES_, id, patch, expectedVersion, { context: context });
    auditCandidate_('CANDIDATE_' + targetStatus, current, updated, context, {
      generated_document_id: payload.generated_document_id || null
    });
    return updated;
  }

  function resolveCreatedEmployee_(result, employeeCode) {
    if (result && result.employee) return result;
    var page = HrEmployeeService.search(employeeCode, null, 'DRAFT', {
      page: 1,
      pageSize: Number(HrConfig.get('MAX_PAGE_SIZE', 100))
    });
    var match = (page.items || []).filter(function (employee) {
      return code_(employee.employee_code) === code_(employeeCode);
    })[0];
    assert_(match, 'CONVERTED_EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân sự vừa chuyển đổi.');
    return {
      employee: HrEmployeeService.get(match.employee_id, { includeSensitive: true }),
      warnings: []
    };
  }

  function convertCandidate_(candidateId, payload, options) {
    payload = payload || {};
    options = options || {};
    var expectedVersion = payload.row_version;
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để chuyển ứng viên thành nhân sự.');
    var context = context_(options);
    var key = options.idempotencyKey || payload.idempotency_key ||
      ['CANDIDATE_CONVERT', candidateId].join(':');

    return HrSheetStore.withIdempotency('CANDIDATE_CONVERT', key, function () {
      var current = getCandidate(candidateId);
      if (current.candidate_status === 'CONVERTED') {
        return {
          candidate: current,
          employee: current.converted_employee_id
            ? HrEmployeeService.get(current.converted_employee_id, { includeSensitive: true })
            : null,
          warnings: []
        };
      }
      assert_(current.candidate_status === 'PASSED',
        'CANDIDATE_TRANSITION_INVALID',
        'Chỉ ứng viên PASSED được chuyển thành nhân sự.');
      assert_(Number(current.row_version) === Number(expectedVersion),
        'ROW_VERSION_CONFLICT',
        'Ứng viên đã được người khác cập nhật.');

      var employeeResult;
      var requestedEmployeeId = trim_(payload.employee_id || payload.converted_employee_id);
      if (requestedEmployeeId) {
        var existing = HrEmployeeService.get(requestedEmployeeId, { includeSensitive: true });
        assert_(existing.employment_status === 'DRAFT',
          'CONVERTED_EMPLOYEE_NOT_DRAFT',
          'Hồ sơ nhân sự chuyển đổi phải ở trạng thái DRAFT.');
        employeeResult = { employee: existing, warnings: [] };
      } else {
        var employeeCode = code_(payload.employee_code || current.candidate_code);
        var hireDate = date_(
          payload.hire_date || plusDays_(current.probation_end_date, 1),
          'hire_date',
          true
        );
        employeeResult = HrEmployeeService.create({
          employee_code: employeeCode,
          full_name: current.full_name,
          gender: current.gender,
          date_of_birth: current.date_of_birth,
          birth_place_current: current.birth_place,
          department_id: current.department_id,
          position_id: current.position_id,
          working_condition_id: current.working_condition_id,
          hire_date: hireDate,
          base_salary: current.base_salary_amount,
          job_description: current.job_description,
          citizen_id: current.citizen_id,
          citizen_id_issued_date: current.citizen_id_issued_date,
          citizen_id_issued_place: current.citizen_id_issued_place,
          permanent_address: current.permanent_address,
          phone: current.phone,
          personal_email: current.email,
          idempotency_key: key + ':EMPLOYEE'
        }, {
          context: context,
          idempotencyKey: key + ':EMPLOYEE'
        });
        employeeResult = resolveCreatedEmployee_(employeeResult, employeeCode);
      }

      var employee = employeeResult.employee;
      var duplicate = all_(CANDIDATES_).some(function (candidate) {
        return candidate.candidate_id !== candidateId &&
          candidate.record_status !== 'DELETED' &&
          candidate.converted_employee_id === employee.employee_id;
      });
      assert_(!duplicate, 'CANDIDATE_ALREADY_CONVERTED', 'Hồ sơ nhân sự đã liên kết với ứng viên khác.');

      var updated = HrSheetStore.update(CANDIDATES_, candidateId, {
        candidate_status: 'CONVERTED',
        status_reason: null,
        converted_employee_id: employee.employee_id,
        converted_at: HrCore.nowIso(),
        converted_by: actor_(context)
      }, current.row_version, { context: context });
      auditCandidate_('CANDIDATE_CONVERTED', current, updated, context, {
        converted_employee_id: employee.employee_id
      });
      return {
        candidate: updated,
        employee: employee,
        warnings: employeeResult.warnings || []
      };
    }, {
      aggregateType: 'PROBATION_CANDIDATE',
      aggregateId: candidateId,
      context: context,
      resultRef: function (result) {
        return result && result.candidate && result.candidate.candidate_id || candidateId;
      },
      replayResolver: function (resultCandidateId) {
        var replayedCandidate = resultCandidateId && HrSheetStore.get(CANDIDATES_, resultCandidateId);
        if (!replayedCandidate) return null;
        return {
          candidate: replayedCandidate,
          employee: replayedCandidate.converted_employee_id
            ? HrEmployeeService.get(replayedCandidate.converted_employee_id, { includeSensitive: true })
            : null,
          warnings: []
        };
      }
    });
  }

  function markContractCreated(candidateId, documentId, expectedVersion, options) {
    bootstrap_();
    return transitionCandidate_(
      candidateId,
      'CONTRACT_CREATED',
      expectedVersion,
      { generated_document_id: documentId },
      options || {}
    );
  }

  function runAction(candidateId, action, payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var normalized = trim_(action).toUpperCase();

    if (normalized === 'GENERATE_DOCUMENT' || normalized === 'GENERATE_CONTRACT') {
      assert_(typeof HrDocumentService !== 'undefined',
        'DOCUMENT_SERVICE_UNAVAILABLE',
        'Dịch vụ tài liệu chưa sẵn sàng.');
      return HrDocumentService.generateProbationContract(candidateId, payload, options);
    }
    if (normalized === 'ACTIVATE_TEMPLATE' || normalized === 'JOB_TEMPLATE_ACTIVATE') {
      return activateJobTemplate(candidateId, payload.row_version, options);
    }
    if (normalized === 'INACTIVATE_TEMPLATE' || normalized === 'JOB_TEMPLATE_INACTIVATE') {
      return inactivateJobTemplate(candidateId, payload.row_version, options);
    }
    if (normalized === 'CONVERT') {
      return convertCandidate_(candidateId, payload, options);
    }

    var targetByAction = {
      CONTRACT_CREATED: 'CONTRACT_CREATED',
      START: 'IN_PROBATION',
      START_PROBATION: 'IN_PROBATION',
      PASS: 'PASSED',
      MARK_PASSED: 'PASSED',
      FAIL: 'FAILED',
      MARK_FAILED: 'FAILED',
      CANCEL: 'CANCELLED'
    };
    var target = targetByAction[normalized];
    assert_(target, 'CANDIDATE_ACTION_INVALID', 'Thao tác thử việc không được hỗ trợ.');
    return transitionCandidate_(
      candidateId,
      target,
      payload.row_version,
      payload,
      options
    );
  }

  return Object.freeze({
    listJobTemplates: listJobTemplates,
    getJobTemplate: getJobTemplate,
    saveJobTemplate: saveJobTemplate,
    activateJobTemplate: activateJobTemplate,
    inactivateJobTemplate: inactivateJobTemplate,
    listCandidates: listCandidates,
    getCandidate: getCandidate,
    saveCandidate: saveCandidate,
    runAction: runAction,
    markContractCreated: markContractCreated
  });
})();

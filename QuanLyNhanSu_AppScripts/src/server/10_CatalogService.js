/**
 * Canonical HR catalog domain service.
 *
 * Public API:
 *   HrCatalogService.list(kind, query)
 *   HrCatalogService.get(kind, id)
 *   HrCatalogService.create(kind, payload, options)
 *   HrCatalogService.update(kind, id, patch, expectedRowVersion, options)
 *   HrCatalogService.inactivate(kind, id, expectedRowVersion, options)
 *
 * `kind` accepts DEPARTMENT, POSITION or WORKING_CONDITION (singular/plural).
 * Deletes are intentionally represented by an INACTIVE transition so legacy
 * references remain resolvable.
 */
var HrCatalogService = (function () {
  'use strict';

  var KINDS_ = {
    DEPARTMENT: {
      tableKey: 'DEPARTMENTS',
      idField: 'department_id',
      parentField: 'parent_department_id'
    },
    POSITION: {
      tableKey: 'POSITIONS',
      idField: 'position_id'
    },
    WORKING_CONDITION: {
      tableKey: 'WORKING_CONDITIONS',
      idField: 'working_condition_id'
    }
  };

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

  function canonicalKind_(kind) {
    var value = String(kind || '').trim().toUpperCase();
    if (value === 'DEPARTMENTS') value = 'DEPARTMENT';
    if (value === 'POSITIONS') value = 'POSITION';
    if (value === 'WORKING_CONDITIONS') value = 'WORKING_CONDITION';
    if (value === 'WORKING-CONDITION') value = 'WORKING_CONDITION';
    assert_(KINDS_[value], 'CATALOG_KIND_INVALID', 'Loại danh mục không được hỗ trợ.');
    return value;
  }

  function info_(kind) {
    var canonical = canonicalKind_(kind);
    var source = KINDS_[canonical];
    var table = HrSchema.TABLES[source.tableKey];
    assert_(table, 'CATALOG_SCHEMA_MISSING', 'Chưa cấu hình bảng danh mục.');
    return {
      kind: canonical,
      table: table,
      idField: source.idField,
      parentField: source.parentField || null
    };
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

  function normalizeCode_(value) {
    return trim_(value).toUpperCase().replace(/\s+/g, '-');
  }

  function number_(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    var parsed = Number(value);
    assert_(isFinite(parsed), 'CATALOG_SORT_ORDER_INVALID', 'Thứ tự danh mục không hợp lệ.');
    return Math.trunc(parsed);
  }

  function validateCode_(code) {
    assert_(code, 'CATALOG_CODE_REQUIRED', 'Mã danh mục là bắt buộc.');
    assert_(/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(code),
      'CATALOG_CODE_INVALID',
      'Mã danh mục chỉ được chứa chữ hoa, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  }

  function validateName_(name) {
    assert_(name, 'CATALOG_NAME_REQUIRED', 'Tên danh mục là bắt buộc.');
    assert_(name.length <= 255, 'CATALOG_NAME_TOO_LONG', 'Tên danh mục vượt quá 255 ký tự.');
  }

  function ensureUnique_(info, code, name, excludeId) {
    var normalizedName = normalize_(name);
    all_(info.table).forEach(function (row) {
      if (excludeId && row[info.idField] === excludeId) return;
      if (normalizeCode_(row.code) === code) {
        fail_('CATALOG_CODE_DUPLICATE', 'Mã danh mục đã tồn tại.');
      }
      if (normalize_(row.name) === normalizedName) {
        fail_('CATALOG_NAME_DUPLICATE', 'Tên danh mục đã tồn tại.');
      }
    });
  }

  function validateParent_(info, recordId, parentId) {
    if (!info.parentField || !parentId) return;
    assert_(recordId !== parentId, 'DEPARTMENT_PARENT_SELF', 'Đơn vị không thể là cấp trên của chính nó.');

    var seen = {};
    if (recordId) seen[recordId] = true;
    var cursorId = parentId;
    while (cursorId) {
      assert_(!seen[cursorId], 'DEPARTMENT_PARENT_CYCLE', 'Quan hệ đơn vị tạo thành vòng lặp.');
      seen[cursorId] = true;
      var cursor = HrSheetStore.get(info.table, cursorId);
      assert_(cursor, 'DEPARTMENT_PARENT_NOT_FOUND', 'Không tìm thấy đơn vị cấp trên.');
      cursorId = cursor[info.parentField] || null;
    }
  }

  function audit_(action, info, id, before, after, context, metadata) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: info.kind,
      entityId: id,
      before: before || null,
      after: after || null,
      context: context,
      metadata: metadata || { catalog_kind: info.kind }
    });
  }

  function withIdempotency_(action, key, aggregateType, aggregateId, context, callback, replayResolver) {
    if (!key || typeof HrSheetStore.withIdempotency !== 'function') return callback();
    return HrSheetStore.withIdempotency(action, key, callback, {
      aggregateType: aggregateType,
      aggregateId: aggregateId,
      context: context,
      replayResolver: replayResolver
    });
  }

  function list(kind, query) {
    bootstrap_();
    query = query || {};
    var info = info_(kind);
    var keyword = normalize_(query.keyword);
    var status = trim_(query.status).toUpperCase();
    var items = all_(info.table).filter(function (row) {
      if (status && status !== 'ALL' && String(row.catalog_status || '').toUpperCase() !== status) return false;
      if (keyword && normalize_([row.code, row.name, row.description].join(' ')).indexOf(keyword) < 0) return false;
      return row.record_status !== 'DELETED';
    });

    items.sort(function (left, right) {
      var order = Number(left.sort_order || 0) - Number(right.sort_order || 0);
      if (order) return order;
      return normalize_(left.name).localeCompare(normalize_(right.name));
    });

    return { items: items, total: items.length, kind: info.kind };
  }

  function get(kind, id) {
    bootstrap_();
    var info = info_(kind);
    assert_(trim_(id), 'CATALOG_ID_REQUIRED', 'ID danh mục là bắt buộc.');
    var record = HrSheetStore.get(info.table, id);
    assert_(record && record.record_status !== 'DELETED', 'CATALOG_NOT_FOUND', 'Không tìm thấy danh mục.');
    return record;
  }

  function create(kind, payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var info = info_(kind);
    var context = context_(options);
    var id = HrCore.uuid();
    var code = normalizeCode_(payload.code);
    var name = trim_(payload.name);

    validateCode_(code);
    validateName_(name);
    ensureUnique_(info, code, name, null);
    validateParent_(info, id, info.parentField ? trim_(payload[info.parentField]) : null);

    var record = {};
    record[info.idField] = id;
    record.code = code;
    record.name = name;
    record.description = trim_(payload.description) || null;
    record.sort_order = number_(payload.sort_order, 0);
    record.catalog_status = 'ACTIVE';
    record.record_status = 'ACTIVE';
    if (info.parentField) record[info.parentField] = trim_(payload[info.parentField]) || null;
    if (payload.legacy_system) record.legacy_system = trim_(payload.legacy_system);
    if (payload.legacy_id) record.legacy_id = trim_(payload.legacy_id);
    if (payload.source_hash) record.source_hash = trim_(payload.source_hash);

    var key = options.idempotencyKey || payload.idempotency_key ||
      ['CATALOG', info.kind, code].join(':');
    return withIdempotency_('CATALOG_CREATE', key, info.kind, id, context, function () {
      ensureUnique_(info, code, name, null);
      var created = HrSheetStore.insert(info.table, record, { context: context });
      audit_('CATALOG_CREATED', info, id, null, created, context);
      return created;
    }, function (recordId) {
      return recordId ? HrSheetStore.get(info.table, recordId) : null;
    });
  }

  function update(kind, id, patch, expectedRowVersion, options) {
    bootstrap_();
    patch = patch || {};
    options = options || {};
    var info = info_(kind);
    var context = context_(options);
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để cập nhật danh mục.');

    var current = get(info.kind, id);
    assert_(current.catalog_status !== 'INACTIVE',
      'CATALOG_INACTIVE_IMMUTABLE',
      'Danh mục đã ngừng sử dụng không thể sửa trực tiếp.');

    var next = {};
    next.code = patch.code === undefined ? current.code : normalizeCode_(patch.code);
    next.name = patch.name === undefined ? current.name : trim_(patch.name);
    next.description = patch.description === undefined ? current.description : (trim_(patch.description) || null);
    next.sort_order = patch.sort_order === undefined ? current.sort_order : number_(patch.sort_order, 0);
    if (info.parentField) {
      next[info.parentField] = patch[info.parentField] === undefined
        ? current[info.parentField]
        : (trim_(patch[info.parentField]) || null);
    }

    validateCode_(next.code);
    validateName_(next.name);
    ensureUnique_(info, next.code, next.name, id);
    validateParent_(info, id, info.parentField ? next[info.parentField] : null);

    var changed = {};
    Object.keys(next).forEach(function (field) {
      if (next[field] !== current[field]) changed[field] = next[field];
    });
    if (!Object.keys(changed).length) return current;

    var updated = HrSheetStore.update(info.table, id, changed, expectedRowVersion, { context: context });
    audit_('CATALOG_UPDATED', info, id, current, updated, context);
    return updated;
  }

  function catalogReferenceCount_(info, id) {
    var fieldByKind = {
      DEPARTMENT: 'department_id',
      POSITION: 'position_id',
      WORKING_CONDITION: 'working_condition_id'
    };
    var field = fieldByKind[info.kind];
    var tableKeys = ['EMPLOYEES', 'PROBATION_JOB_TEMPLATES', 'PROBATION_CANDIDATES'];
    var count = 0;
    tableKeys.forEach(function (tableKey) {
      var table = HrSchema.TABLES[tableKey];
      if (!table) return;
      all_(table).forEach(function (row) {
        if (row.record_status !== 'DELETED' && row[field] === id) count += 1;
      });
    });
    return count;
  }

  function inactivate(kind, id, expectedRowVersion, options) {
    bootstrap_();
    options = options || {};
    var info = info_(kind);
    var context = context_(options);
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để ngừng sử dụng danh mục.');
    var current = get(info.kind, id);
    if (current.catalog_status === 'INACTIVE') return current;

    var references = catalogReferenceCount_(info, id);
    assert_(references === 0,
      'CATALOG_IN_USE',
      'Danh mục đang được tham chiếu; cần chuyển dữ liệu trước khi ngừng sử dụng.',
      { reference_count: references });

    var updated = HrSheetStore.update(
      info.table,
      id,
      { catalog_status: 'INACTIVE' },
      expectedRowVersion,
      { context: context }
    );
    audit_('CATALOG_INACTIVATED', info, id, current, updated, context);
    return updated;
  }

  function getAll(query) {
    return {
      departments: list('DEPARTMENT', query).items,
      positions: list('POSITION', query).items,
      working_conditions: list('WORKING_CONDITION', query).items
    };
  }

  function save(kind, payload, options) {
    payload = payload || {};
    options = options || {};
    var info = info_(kind);
    var id = payload[info.idField] || payload.id || null;
    if (!id) return create(info.kind, payload, options);
    var expectedVersion = options.expectedRowVersion;
    if (expectedVersion === undefined) expectedVersion = payload.row_version;
    return update(info.kind, id, payload, expectedVersion, options);
  }

  return Object.freeze({
    list: list,
    getAll: getAll,
    get: get,
    create: create,
    update: update,
    save: save,
    inactivate: inactivate
  });
})();

/**
 * Workforce movement ledger and live roster projection.
 *
 * Public API:
 *   HrWorkforceService.list(query)
 *   HrWorkforceService.createDraft(payload, options)
 *   HrWorkforceService.updateDraft(id, patch, expectedRowVersion, options)
 *   HrWorkforceService.preview(id)
 *   HrWorkforceService.confirm(id, expectedRowVersion, idempotencyKey, options)
 *   HrWorkforceService.cancel(id, expectedRowVersion, reason, options)
 *   HrWorkforceService.liveRoster(asOfDate, query)
 *   HrWorkforceService.listRosters(query)
 *
 * The MVP deliberately enables only INCREASE and DECREASE. Confirmed and
 * cancelled ledger rows are immutable.
 */
var HrWorkforceService = (function () {
  'use strict';

  var MOVEMENTS_ = null;
  var EMPLOYEES_ = null;
  var ENABLED_TYPES_ = ['INCREASE', 'DECREASE'];

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
    MOVEMENTS_ = MOVEMENTS_ || HrSchema.TABLES.WORKFORCE_MOVEMENTS;
    EMPLOYEES_ = EMPLOYEES_ || HrSchema.TABLES.EMPLOYEES;
    assert_(MOVEMENTS_ && EMPLOYEES_, 'WORKFORCE_SCHEMA_MISSING', 'Chưa cấu hình bảng biến động nhân sự.');
  }

  function context_(options) {
    options = options || {};
    return options.context || HrCore.context(options.requestId);
  }

  function actor_(context) {
    return context && (
      context.actorId || context.actor_id || context.actorKey || context.actor_key ||
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

  function today_() {
    return Utilities.formatDate(
      new Date(),
      HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
      'yyyy-MM-dd'
    );
  }

  function date_(value, field, required) {
    if (value === null || value === undefined || value === '') {
      assert_(!required, 'MOVEMENT_DATE_REQUIRED', 'Thiếu ngày bắt buộc.', { field: field });
      return null;
    }
    var text = Object.prototype.toString.call(value) === '[object Date]'
      ? Utilities.formatDate(value, HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'), 'yyyy-MM-dd')
      : trim_(value);
    assert_(/^\d{4}-\d{2}-\d{2}$/.test(text),
      'MOVEMENT_DATE_INVALID',
      'Ngày phải có định dạng yyyy-MM-dd.',
      { field: field });
    var parsed = new Date(text + 'T00:00:00Z');
    assert_(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text,
      'MOVEMENT_DATE_INVALID',
      'Ngày không hợp lệ.',
      { field: field });
    return text;
  }

  function getEmployee_(employeeId) {
    var employee = HrSheetStore.get(EMPLOYEES_, employeeId);
    assert_(employee && employee.record_status !== 'DELETED', 'EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân sự.');
    return employee;
  }

  function getMovement_(movementId) {
    var movement = HrSheetStore.get(MOVEMENTS_, movementId);
    assert_(movement && movement.record_status !== 'DELETED', 'MOVEMENT_NOT_FOUND', 'Không tìm thấy biến động.');
    return movement;
  }

  function validateType_(value) {
    var type = trim_(value).toUpperCase();
    assert_(ENABLED_TYPES_.indexOf(type) >= 0,
      'MOVEMENT_TYPE_NOT_ENABLED',
      'MVP chỉ hỗ trợ biến động tăng hoặc giảm nhân sự.');
    return type;
  }

  function validateCatalog_(field, id) {
    if (!id) return null;
    var mapping = {
      department_id: { table: HrSchema.TABLES.DEPARTMENTS, idField: 'department_id' },
      position_id: { table: HrSchema.TABLES.POSITIONS, idField: 'position_id' },
      working_condition_id: {
        table: HrSchema.TABLES.WORKING_CONDITIONS,
        idField: 'working_condition_id'
      }
    };
    var info = mapping[field];
    var row = info && info.table && HrSheetStore.get(info.table, id);
    assert_(row && row.catalog_status === 'ACTIVE' && row.record_status !== 'DELETED',
      'MOVEMENT_CATALOG_NOT_ACTIVE',
      'Danh mục đích không tồn tại hoặc đã ngừng sử dụng.',
      { field: field });
    return id;
  }

  function movementRecord_(payload, employee, id, idempotencyKey) {
    var type = validateType_(payload.movement_type || payload.type);
    var effectiveDate = date_(payload.effective_date, 'effective_date', true);
    var reason = trim_(payload.reason) || null;
    if (type === 'INCREASE') {
      assert_(employee.employment_status === 'DRAFT',
        'INCREASE_REQUIRES_DRAFT_EMPLOYEE',
        'Tăng mới chỉ áp dụng cho hồ sơ nhân sự DRAFT.');
    } else {
      assert_(employee.employment_status === 'ACTIVE',
        'DECREASE_REQUIRES_ACTIVE_EMPLOYEE',
        'Giảm nhân sự chỉ áp dụng cho nhân sự đang ACTIVE.');
      assert_(reason, 'DECREASE_REASON_REQUIRED', 'Giảm nhân sự bắt buộc có lý do.');
    }

    var toDepartment = trim_(payload.to_department_id || employee.department_id) || null;
    var toPosition = trim_(payload.to_position_id || employee.position_id) || null;
    var toCondition = trim_(payload.to_working_condition_id || employee.working_condition_id) || null;
    if (type === 'INCREASE') {
      validateCatalog_('department_id', toDepartment);
      validateCatalog_('position_id', toPosition);
      validateCatalog_('working_condition_id', toCondition);
    }

    return {
      movement_id: id,
      employee_id: employee.employee_id,
      movement_type: type,
      movement_status: 'DRAFT',
      effective_date: effectiveDate,
      from_department_id: employee.department_id || null,
      to_department_id: toDepartment,
      from_position_id: employee.position_id || null,
      to_position_id: toPosition,
      from_working_condition_id: employee.working_condition_id || null,
      to_working_condition_id: toCondition,
      from_employee_status: employee.employment_status,
      to_employee_status: type === 'INCREASE' ? 'ACTIVE' : 'INACTIVE',
      reason: reason,
      decision_number: trim_(payload.decision_number) || null,
      decision_date: date_(payload.decision_date, 'decision_date', false),
      correction_of_movement_id: trim_(payload.correction_of_movement_id) || null,
      idempotency_key: idempotencyKey,
      record_status: 'ACTIVE'
    };
  }

  function auditView_(row) {
    if (!row) return null;
    return {
      movement_id: row.movement_id,
      employee_id: row.employee_id,
      movement_type: row.movement_type,
      movement_status: row.movement_status,
      effective_date: row.effective_date,
      from_employee_status: row.from_employee_status,
      to_employee_status: row.to_employee_status,
      row_version: row.row_version
    };
  }

  function audit_(action, before, after, context, metadata) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'WORKFORCE_MOVEMENT',
      entityId: (after || before).movement_id,
      before: auditView_(before),
      after: auditView_(after),
      context: context,
      metadata: metadata || {}
    });
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
    var type = trim_(query.type || query.movement_type).toUpperCase();
    var status = trim_(query.status || query.movement_status).toUpperCase();
    var fromDate = query.from_date ? date_(query.from_date, 'from_date', false) : null;
    var toDate = query.to_date ? date_(query.to_date, 'to_date', false) : null;
    var employeeId = trim_(query.employee_id);
    var keyword = normalize_(query.keyword);
    var employeeMap = {};
    all_(EMPLOYEES_).forEach(function (employee) { employeeMap[employee.employee_id] = employee; });

    var items = all_(MOVEMENTS_).filter(function (row) {
      if (row.record_status === 'DELETED') return false;
      if (type && type !== 'ALL' && row.movement_type !== type) return false;
      if (status && status !== 'ALL' && row.movement_status !== status) return false;
      if (employeeId && row.employee_id !== employeeId) return false;
      if (fromDate && row.effective_date < fromDate) return false;
      if (toDate && row.effective_date > toDate) return false;
      var employee = employeeMap[row.employee_id] || {};
      if (keyword && normalize_([employee.employee_code, employee.full_name, row.reason].join(' ')).indexOf(keyword) < 0) {
        return false;
      }
      return true;
    }).map(function (row) {
      var employee = employeeMap[row.employee_id] || {};
      var result = {};
      Object.keys(row).forEach(function (field) { result[field] = row[field]; });
      result.employee_code = employee.employee_code || null;
      result.employee_name = employee.full_name || null;
      return result;
    });

    items.sort(function (left, right) {
      var dateOrder = String(right.effective_date).localeCompare(String(left.effective_date));
      if (dateOrder) return dateOrder;
      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    });
    return paginate_(items, query);
  }

  function createDraft(payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    if (payload.movement_id || payload.id) {
      return updateDraft(
        payload.movement_id || payload.id,
        payload,
        options.expectedRowVersion === undefined ? payload.row_version : options.expectedRowVersion,
        options
      );
    }

    var employeeId = trim_(payload.employee_id);
    assert_(employeeId, 'MOVEMENT_EMPLOYEE_REQUIRED', 'ID nhân sự là bắt buộc.');
    var employee = getEmployee_(employeeId);
    var context = context_(options);
    var id = HrCore.uuid();
    var provisionalType = validateType_(payload.movement_type || payload.type);
    var effectiveDate = date_(payload.effective_date, 'effective_date', true);
    var key = options.idempotencyKey || payload.idempotency_key ||
      ['MOVEMENT', provisionalType, employeeId, effectiveDate].join(':');
    var record = movementRecord_(payload, employee, id, key);

    return HrSheetStore.withIdempotency('MOVEMENT_CREATE_DRAFT', key, function () {
      var created = HrSheetStore.insert(MOVEMENTS_, record, { context: context });
      audit_('MOVEMENT_DRAFT_CREATED', null, created, context);
      return created;
    }, {
      aggregateType: 'WORKFORCE_MOVEMENT',
      aggregateId: id,
      context: context,
      replayResolver: function (movementId) {
        return movementId ? HrSheetStore.get(MOVEMENTS_, movementId) : null;
      }
    });
  }

  function updateDraft(movementId, patch, expectedRowVersion, options) {
    bootstrap_();
    patch = patch || {};
    options = options || {};
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để cập nhật biến động.');
    var current = getMovement_(movementId);
    assert_(current.movement_status === 'DRAFT',
      'MOVEMENT_IMMUTABLE',
      'Chỉ biến động DRAFT được sửa.');
    var employee = getEmployee_(current.employee_id);
    var merged = {};
    Object.keys(current).forEach(function (field) { merged[field] = current[field]; });
    [
      'movement_type', 'type', 'effective_date', 'to_department_id',
      'to_position_id', 'to_working_condition_id', 'reason',
      'decision_number', 'decision_date', 'correction_of_movement_id'
    ].forEach(function (field) {
      if (patch[field] !== undefined) merged[field] = patch[field];
    });
    var normalized = movementRecord_(merged, employee, movementId, current.idempotency_key);
    delete normalized.movement_id;
    delete normalized.employee_id;
    delete normalized.movement_status;
    delete normalized.record_status;
    delete normalized.idempotency_key;

    var changed = {};
    Object.keys(normalized).forEach(function (field) {
      if (normalized[field] !== current[field]) changed[field] = normalized[field];
    });
    if (!Object.keys(changed).length) return current;

    var context = context_(options);
    var updated = HrSheetStore.update(MOVEMENTS_, movementId, changed, expectedRowVersion, { context: context });
    audit_('MOVEMENT_DRAFT_UPDATED', current, updated, context, { changed_fields: Object.keys(changed) });
    return updated;
  }

  function preview(movementId) {
    bootstrap_();
    var movement = getMovement_(movementId);
    assert_(movement.movement_status === 'DRAFT',
      'MOVEMENT_PREVIEW_STATUS_INVALID',
      'Chỉ biến động DRAFT có thể xem trước.');
    var employee = getEmployee_(movement.employee_id);
    var activeCount = all_(EMPLOYEES_).filter(function (row) {
      return row.record_status !== 'DELETED' && row.employment_status === 'ACTIVE';
    }).length;
    var delta = movement.movement_type === 'INCREASE' ? 1 : -1;
    return {
      movement_id: movement.movement_id,
      row_version: movement.row_version,
      effective_date: movement.effective_date,
      movement_type: movement.movement_type,
      employee: {
        employee_id: employee.employee_id,
        employee_code: employee.employee_code,
        full_name: employee.full_name
      },
      before: {
        employment_status: employee.employment_status,
        department_id: employee.department_id || null,
        position_id: employee.position_id || null,
        working_condition_id: employee.working_condition_id || null
      },
      after: {
        employment_status: movement.to_employee_status,
        department_id: movement.to_department_id || null,
        position_id: movement.to_position_id || null,
        working_condition_id: movement.to_working_condition_id || null
      },
      active_count_before: activeCount,
      active_count_after: activeCount + delta,
      warnings: movement.effective_date > today_()
        ? [{ code: 'FUTURE_EFFECTIVE_DATE', severity: 'INFO' }]
        : []
    };
  }

  function applyEmployeeProjection_(movement, employee, context) {
    var desiredStatus = movement.to_employee_status;
    var alreadyApplied = employee.employment_status === desiredStatus &&
      employee.status_effective_date === movement.effective_date;
    if (alreadyApplied) return employee;

    assert_(employee.employment_status === movement.from_employee_status,
      'MOVEMENT_EMPLOYEE_STATE_CHANGED',
      'Trạng thái nhân sự đã thay đổi sau khi tạo bản nháp; cần hủy và tạo biến động mới.');
    var patch = {
      employment_status: desiredStatus,
      status_effective_date: movement.effective_date,
      department_id: movement.to_department_id || employee.department_id || null,
      position_id: movement.to_position_id || employee.position_id || null,
      working_condition_id: movement.to_working_condition_id || employee.working_condition_id || null
    };
    if (movement.movement_type === 'INCREASE') {
      patch.hire_date = employee.hire_date || movement.effective_date;
      patch.termination_date = null;
    } else {
      patch.termination_date = movement.effective_date;
    }
    return HrSheetStore.update(
      EMPLOYEES_,
      employee.employee_id,
      patch,
      employee.row_version,
      { context: context }
    );
  }

  function confirm(movementId, expectedRowVersion, idempotencyKey, options) {
    bootstrap_();
    options = options || {};
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để xác nhận biến động.');
    assert_(trim_(idempotencyKey), 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu idempotency key khi xác nhận biến động.');
    var context = context_(options);
    return HrSheetStore.withIdempotency('MOVEMENT_CONFIRM', idempotencyKey, function () {
      var movement = getMovement_(movementId);
      if (movement.movement_status === 'CONFIRMED') return movement;
      assert_(movement.movement_status === 'DRAFT',
        'MOVEMENT_CONFIRM_STATUS_INVALID',
        'Chỉ biến động DRAFT được xác nhận.');
      assert_(Number(movement.row_version) === Number(expectedRowVersion),
        'ROW_VERSION_CONFLICT',
        'Biến động đã được người khác cập nhật.');
      assert_(movement.effective_date <= today_(),
        'MOVEMENT_FUTURE_CONFIRM_NOT_SUPPORTED',
        'MVP chưa xác nhận biến động có ngày hiệu lực trong tương lai.');

      var employee = getEmployee_(movement.employee_id);
      var projected = applyEmployeeProjection_(movement, employee, context);
      var updated = HrSheetStore.update(MOVEMENTS_, movementId, {
        movement_status: 'CONFIRMED',
        confirmed_at: HrCore.nowIso(),
        confirmed_by: actor_(context)
      }, movement.row_version, { context: context });
      audit_('MOVEMENT_CONFIRMED', movement, updated, context, {
        employee_status_before: employee.employment_status,
        employee_status_after: projected.employment_status
      });
      return updated;
    }, {
      aggregateType: 'WORKFORCE_MOVEMENT',
      aggregateId: movementId,
      context: context,
      replayResolver: function (resultId) {
        return resultId ? HrSheetStore.get(MOVEMENTS_, resultId) : null;
      }
    });
  }

  function cancel(movementId, expectedRowVersion, reason, options) {
    bootstrap_();
    options = options || {};
    assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để hủy biến động.');
    var current = getMovement_(movementId);
    if (current.movement_status === 'CANCELLED') return current;
    assert_(current.movement_status === 'DRAFT',
      'MOVEMENT_IMMUTABLE',
      'Biến động đã xác nhận không thể hủy; phải tạo correction theo quy trình được duyệt.');
    var cancelReason = trim_(reason);
    assert_(cancelReason, 'MOVEMENT_CANCEL_REASON_REQUIRED', 'Hủy biến động bắt buộc có lý do.');
    var context = context_(options);
    var updated = HrSheetStore.update(MOVEMENTS_, movementId, {
      movement_status: 'CANCELLED',
      reason: cancelReason,
      cancelled_at: HrCore.nowIso(),
      cancelled_by: actor_(context)
    }, expectedRowVersion, { context: context });
    audit_('MOVEMENT_CANCELLED', current, updated, context);
    return updated;
  }

  function liveRoster(asOfDate, query) {
    bootstrap_();
    query = query || {};
    var businessDate = date_(asOfDate || today_(), 'as_of_date', true);
    var states = {};
    all_(EMPLOYEES_).forEach(function (employee) {
      if (employee.record_status === 'DELETED') return;
      states[employee.employee_id] = {
        source: employee,
        employment_status: employee.employment_status,
        department_id: employee.department_id || null,
        position_id: employee.position_id || null,
        working_condition_id: employee.working_condition_id || null
      };
    });

    // Employee master is the current projection. Reverse movements newer than
    // the requested business date to obtain an historical live projection.
    all_(MOVEMENTS_).filter(function (movement) {
      return movement.record_status !== 'DELETED' &&
        movement.movement_status === 'CONFIRMED' &&
        movement.effective_date > businessDate;
    }).sort(function (left, right) {
      return String(right.effective_date).localeCompare(String(left.effective_date));
    }).forEach(function (movement) {
      var state = states[movement.employee_id];
      if (!state) return;
      state.employment_status = movement.from_employee_status;
      state.department_id = movement.from_department_id || null;
      state.position_id = movement.from_position_id || null;
      state.working_condition_id = movement.from_working_condition_id || null;
    });

    var keyword = normalize_(query.keyword);
    var departmentId = trim_(query.department_id);
    var items = Object.keys(states).map(function (id) {
      var state = states[id];
      var employee = state.source;
      return {
        employee_id: id,
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        department_id: state.department_id,
        position_id: state.position_id,
        working_condition_id: state.working_condition_id,
        employment_status: state.employment_status,
        as_of_date: businessDate
      };
    }).filter(function (item) {
      if (item.employment_status !== 'ACTIVE') return false;
      if (departmentId && item.department_id !== departmentId) return false;
      if (keyword && normalize_([item.employee_code, item.full_name].join(' ')).indexOf(keyword) < 0) return false;
      return true;
    });
    items.sort(function (left, right) {
      return String(left.employee_code || '').localeCompare(String(right.employee_code || ''));
    });
    var page = paginate_(items, query);
    page.as_of_date = businessDate;
    page.active_count = items.length;
    page.projection_kind = 'LIVE';
    return page;
  }

  function listRosters(query) {
    query = query || {};
    var asOfDate = query.as_of_date || query.period_start || today_();
    var roster = liveRoster(asOfDate, query);
    var summary = {
      roster_id: 'LIVE:' + roster.as_of_date,
      period_start: roster.as_of_date.slice(0, 7) + '-01',
      roster_kind: 'LIVE_PROJECTION',
      roster_status: 'ACTIVE',
      item_count: roster.active_count,
      as_of_date: roster.as_of_date
    };
    return {
      items: [summary],
      total: 1,
      live_items: query.includeItems ? roster.items : undefined
    };
  }

  return Object.freeze({
    list: list,
    createDraft: createDraft,
    updateDraft: updateDraft,
    preview: preview,
    confirm: confirm,
    cancel: cancel,
    liveRoster: liveRoster,
    listRosters: listRosters
  });
})();

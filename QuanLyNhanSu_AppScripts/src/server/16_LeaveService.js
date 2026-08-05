/**
 * Annual leave entitlement service.
 *
 * Rules:
 * - Base leave days come from working condition catalog.
 * - Every full 5 years of service adds 1 day.
 * - Manual override is stored by employee and leave year.
 */
var HrLeaveService = (function () {
  'use strict';

  var EMPLOYEES_ = null;
  var CONDITIONS_ = null;
  var ENTITLEMENTS_ = null;

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
    EMPLOYEES_ = EMPLOYEES_ || HrSchema.TABLES.EMPLOYEES;
    CONDITIONS_ = CONDITIONS_ || HrSchema.TABLES.WORKING_CONDITIONS;
    ENTITLEMENTS_ = ENTITLEMENTS_ || HrSchema.TABLES.EMPLOYEE_LEAVE_ENTITLEMENTS;
    assert_(EMPLOYEES_ && CONDITIONS_ && ENTITLEMENTS_,
      'LEAVE_SCHEMA_MISSING',
      'Chưa cấu hình bảng ngày phép năm.');
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

  function number_(value, field, allowNull) {
    if (value === null || value === undefined || value === '') {
      assert_(allowNull !== false, 'LEAVE_NUMBER_REQUIRED', 'Thiếu giá trị số bắt buộc.', { field: field });
      return null;
    }
    var parsed = Number(value);
    assert_(isFinite(parsed) && parsed >= 0, 'LEAVE_NUMBER_INVALID', 'Giá trị ngày phép không hợp lệ.', { field: field });
    return Math.round(parsed * 100) / 100;
  }

  function year_(value) {
    var parsed = Number(value);
    assert_(isFinite(parsed) && parsed >= 2000 && parsed <= 2100,
      'LEAVE_YEAR_INVALID',
      'Năm áp dụng không hợp lệ.');
    return Math.trunc(parsed);
  }

  function dateParts_(value) {
    var text = trim_(value);
    if (/^\d+(\.\d+)?$/.test(text)) {
      var numeric = Number(text);
      if (isFinite(numeric) && numeric > 0 && numeric < 90000) {
        var baseUtc = Date.UTC(1899, 11, 30);
        var parsed = new Date(baseUtc + Math.round(numeric * 86400000));
        text = parsed.toISOString().slice(0, 10);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    } : null;
  }

  function compareDateParts_(left, right) {
    if (left.year !== right.year) return left.year - right.year;
    if (left.month !== right.month) return left.month - right.month;
    return left.day - right.day;
  }

  function fullYearsBetween_(startDate, leaveYear) {
    var start = dateParts_(startDate);
    if (!start) return 0;
    var target = { year: leaveYear, month: 12, day: 31 };
    if (compareDateParts_(start, target) > 0) return 0;
    var years = leaveYear - start.year;
    if (start.month > 12 || (start.month === 12 && start.day > 31)) years -= 1;
    return Math.max(years, 0);
  }

  function employee_(employeeId) {
    var row = HrSheetStore.get(EMPLOYEES_, employeeId);
    assert_(row && row.record_status !== 'DELETED', 'EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân sự.');
    return row;
  }

  function workingCondition_(workingConditionId) {
    if (!workingConditionId) return null;
    var row = HrSheetStore.get(CONDITIONS_, workingConditionId);
    return row && row.record_status !== 'DELETED' ? row : null;
  }

  function entitlementRow_(employeeId, leaveYear) {
    var found = all_(ENTITLEMENTS_).filter(function (row) {
      return row.record_status !== 'DELETED' &&
        row.employee_id === employeeId &&
        Number(row.leave_year) === Number(leaveYear);
    })[0];
    return found || null;
  }

  function snapshot_(employee, leaveYear, entitlement) {
    var condition = workingCondition_(employee.working_condition_id);
    var baseDays = number_(condition && condition.annual_leave_days_base, 'annual_leave_days_base', true);
    if (baseDays === null) baseDays = 12;
    var accrualStartDate = employee.leave_accrual_start_date || employee.official_date || employee.hire_date || null;
    var seniorityBonusDays = Math.floor(fullYearsBetween_(accrualStartDate, leaveYear) / 5);
    var calculatedDays = Math.round((baseDays + seniorityBonusDays) * 100) / 100;
    var manualOverrideDays = entitlement ? entitlement.manual_override_days : null;
    var finalDays = manualOverrideDays === null || manualOverrideDays === undefined
      ? calculatedDays
      : number_(manualOverrideDays, 'manual_override_days', true);
    return {
      leave_entitlement_id: entitlement ? entitlement.leave_entitlement_id : null,
      employee_id: employee.employee_id,
      leave_year: leaveYear,
      working_condition_id: employee.working_condition_id || null,
      working_condition_name: condition && condition.name || null,
      accrual_start_date: accrualStartDate,
      base_days: baseDays,
      seniority_bonus_days: seniorityBonusDays,
      calculated_days: calculatedDays,
      manual_override_days: manualOverrideDays,
      final_days: finalDays,
      note: entitlement && entitlement.note || null,
      row_version: entitlement ? entitlement.row_version : null
    };
  }

  function auditView_(snapshot) {
    if (!snapshot) return null;
    return {
      employee_id: snapshot.employee_id,
      leave_year: snapshot.leave_year,
      manual_override_days: snapshot.manual_override_days,
      final_days: snapshot.final_days,
      row_version: snapshot.row_version
    };
  }

  function audit_(action, before, after, context) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'EMPLOYEE_LEAVE_ENTITLEMENT',
      entityId: (after && after.leave_entitlement_id) || (before && before.leave_entitlement_id) ||
        [(after || before).employee_id, (after || before).leave_year].join(':'),
      before: auditView_(before),
      after: auditView_(after),
      context: context,
      metadata: {
        employee_id: (after || before).employee_id,
        leave_year: (after || before).leave_year
      }
    });
  }

  function get(employeeId, leaveYear) {
    bootstrap_();
    var yearValue = year_(leaveYear);
    var employee = employee_(employeeId);
    return snapshot_(employee, yearValue, entitlementRow_(employeeId, yearValue));
  }

  function update(employeeId, payload, options) {
    bootstrap_();
    payload = payload || {};
    options = options || {};
    var context = context_(options);
    var leaveYear = year_(payload.leave_year || payload.leaveYear);
    var expectedRowVersion = payload.row_version;
    if (expectedRowVersion === undefined) expectedRowVersion = payload.rowVersion;
    var employee = employee_(employeeId);
    var existing = entitlementRow_(employeeId, leaveYear);
    if (existing) {
      assert_(expectedRowVersion !== null && expectedRowVersion !== undefined,
        'ROW_VERSION_REQUIRED',
        'Cần row_version để cập nhật ngày phép năm.');
    }
    var before = snapshot_(employee, leaveYear, existing);
    var patch = {
      manual_override_days: payload.manual_override_days === undefined && payload.manualOverrideDays === undefined
        ? existing && existing.manual_override_days
        : number_(
          payload.manual_override_days !== undefined ? payload.manual_override_days : payload.manualOverrideDays,
          'manual_override_days',
          true
        ),
      note: trim_(payload.note) || null
    };

    var row;
    if (!existing) {
      row = HrSheetStore.insert(ENTITLEMENTS_, {
        leave_entitlement_id: HrCore.uuid(),
        employee_id: employeeId,
        leave_year: leaveYear,
        manual_override_days: patch.manual_override_days,
        note: patch.note,
        record_status: 'ACTIVE'
      }, { context: context });
      audit_('LEAVE_ENTITLEMENT_CREATED', before, snapshot_(employee, leaveYear, row), context);
    } else {
      row = HrSheetStore.update(ENTITLEMENTS_, existing.leave_entitlement_id, patch, expectedRowVersion, {
        context: context
      });
      audit_('LEAVE_ENTITLEMENT_UPDATED', before, snapshot_(employee, leaveYear, row), context);
    }
    return snapshot_(employee, leaveYear, row);
  }

  return Object.freeze({
    get: get,
    update: update
  });
})();

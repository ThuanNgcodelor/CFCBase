/**
 * Prepares helper sheets inside the Google Sheet so exported XLSX files carry
 * a readable annual leave summary alongside the operational tables.
 */
var HrWorkbookExportService = (function () {
  'use strict';

  var LEAVE_SHEET_PREFIX_ = 'PHEP_NAM_';

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

  function trim_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function year_(value) {
    var fallback = Number(
      Utilities.formatDate(new Date(), HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'), 'yyyy')
    );
    if (value === null || value === undefined || value === '') return fallback;
    var parsed = Number(value);
    assert_(isFinite(parsed) && parsed >= 2000 && parsed <= 2100,
      'EXPORT_YEAR_INVALID',
      'Năm export không hợp lệ.');
    return Math.trunc(parsed);
  }

  function sheetName_(leaveYear) {
    return LEAVE_SHEET_PREFIX_ + leaveYear;
  }

  function all_(table) {
    return rows_(HrSheetStore.list(table));
  }

  function catalogMap_(tableName, idField) {
    var result = {};
    all_(tableName).forEach(function (row) {
      if (row.record_status === 'DELETED') return;
      result[row[idField]] = row;
    });
    return result;
  }

  function blankRows_(rowCount, columnCount) {
    var rows = [];
    for (var rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      var row = [];
      for (var columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        row.push('');
      }
      rows.push(row);
    }
    return rows;
  }

  function writeSheet_(sheet, values) {
    var rowCount = values.length;
    var columnCount = values[0].length;
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (lastRow > 0 && lastColumn > 0) {
      sheet.getRange(1, 1, lastRow, lastColumn).setValues(blankRows_(lastRow, lastColumn));
    }
    sheet.getRange(1, 1, rowCount, columnCount).setValues(values);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(2);
  }

  function prepareAnnualLeaveSheet(leaveYear) {
    HrSheetStore.bootstrap();
    var yearValue = year_(leaveYear);
    var spreadsheet = HrConfig.openSpreadsheet();
    var asOfDate = yearValue + '-12-31';
    var roster = HrWorkforceService.liveRoster(asOfDate, {
      page: 1,
      pageSize: Number(HrConfig.get(HrConfig.KEYS.MAX_PAGE_SIZE, 500))
    });
    var departments = catalogMap_(HrSchema.TABLES.DEPARTMENTS, 'department_id');
    var positions = catalogMap_(HrSchema.TABLES.POSITIONS, 'position_id');
    var conditions = catalogMap_(HrSchema.TABLES.WORKING_CONDITIONS, 'working_condition_id');
    var employees = all_(HrSchema.TABLES.EMPLOYEES).reduce(function (accumulator, row) {
      if (row.record_status === 'DELETED') return accumulator;
      accumulator[row.employee_id] = row;
      return accumulator;
    }, {});

    var rows = [
      ['TỔNG HỢP NGÀY PHÉP NĂM', yearValue, '', '', '', '', '', '', '', '', '', '', ''],
      ['STT', 'Năm', 'Mã nhân sự', 'Họ và tên', 'Phòng ban', 'Chức vụ', 'Điều kiện lao động', 'Mốc tính phép', 'Ngày phép nền', 'Thâm niên +', 'Chỉnh tay', 'Ngày phép cuối cùng', 'Ghi chú']
    ];

    (roster.items || []).forEach(function (item, index) {
      var employee = employees[item.employee_id] || null;
      if (!employee) return;
      var leave = HrLeaveService.get(item.employee_id, yearValue);
      rows.push([
        index + 1,
        yearValue,
        employee.employee_code || '',
        employee.full_name || '',
        (departments[item.department_id] || {}).name || '',
        (positions[item.position_id] || {}).name || '',
        leave.working_condition_name || (conditions[item.working_condition_id] || {}).name || '',
        leave.accrual_start_date || '',
        leave.base_days,
        leave.seniority_bonus_days,
        leave.manual_override_days === null || leave.manual_override_days === undefined ? '' : leave.manual_override_days,
        leave.final_days,
        leave.note || ''
      ]);
    });

    var sheet = spreadsheet.getSheetByName(sheetName_(yearValue));
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName_(yearValue));
    writeSheet_(sheet, rows);
    return {
      year: yearValue,
      sheetName: sheetName_(yearValue),
      employeeCount: Math.max(rows.length - 2, 0),
      asOfDate: asOfDate
    };
  }

  return Object.freeze({
    prepareAnnualLeaveSheet: prepareAnnualLeaveSheet
  });
})();

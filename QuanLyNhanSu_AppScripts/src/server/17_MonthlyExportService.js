/**
 * Bounded monthly workforce workbook export.
 *
 * This service intentionally creates a short-lived, private spreadsheet and
 * exports that spreadsheet only. The primary HR spreadsheet is never exported.
 *
 * Public API:
 *   HrMonthlyExportService.buildPlan(year, month)
 *   HrMonthlyExportService.exportMonth(year, month)
 *
 * exportMonth returns a google.script.run-safe payload:
 * {
 *   fileName, mimeType, base64, byteLength, period, sheetNames, counts
 * }
 *
 * It never returns a Google Drive or Spreadsheet identifier.
 */
var HrMonthlyExportService = (function () {
  'use strict';

  var XLSX_MIME_ = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var MAX_ROSTER_ROWS_ = 2000;
  var MAX_MOVEMENT_ROWS_ = 4000;
  var MAX_EXPORT_BYTES_ = 10 * 1024 * 1024;
  var SHEET_NAMES_ = Object.freeze(['TĂNG', 'GIẢM']);

  var INCREASE_HEADERS_ = Object.freeze([
    'THÁNG',
    'STT',
    'MÃ SỐ',
    'HỌ VÀ TÊN',
    'NGÀY SINH',
    'SỐ HỢP ĐỒNG',
    'NGÀY VÀO LÀM',
    'ĐƠN VỊ CÔNG TÁC',
    'LƯƠNG CHÍNH',
    'SỐ SỔ BHXH',
    'GHI CHÚ BHXH',
    'LÝ DO TĂNG'
  ]);

  var DECREASE_HEADERS_ = Object.freeze([
    'THÁNG',
    'STT',
    'MÃ SỐ',
    'HỌ VÀ TÊN',
    'NGÀY SINH',
    'NGÀY VÀO LÀM',
    'SỐ QUYẾT ĐỊNH',
    'NGÀY QUYẾT ĐỊNH',
    'ĐƠN VỊ CÔNG TÁC',
    'LÝ DO GIẢM'
  ]);

  // This is the useful 34-column legacy workforce report shape. Canonical
  // employee fields map one-to-one; a cell is blank only when its value is
  // genuinely absent from the employee record.
  var ROSTER_HEADERS_ = Object.freeze([
    'STT',
    'STT PHÒNG BAN',
    'MÃ SỐ',
    'SỐ SỔ BHXH',
    'HỌ VÀ TÊN',
    'SỐ THẺ BHYT',
    'LƯƠNG',
    'PHỤ CẤP',
    'TỔNG THU NHẬP',
    'GIỚI TÍNH',
    'DÂN TỘC',
    'TÔN GIÁO',
    'CHỨC VỤ',
    'ĐƠN VỊ CÔNG TÁC',
    'NGÀY SINH',
    'NGÀY VÀO LÀM',
    'LOẠI HỢP ĐỒNG',
    'SỐ HỢP ĐỒNG',
    'THÂM NIÊN',
    'CMND',
    'CCCD',
    'NGÀY CẤP',
    'ĐIỀU KIỆN LÀM VIỆC',
    'NƠI CẤP',
    'NGUYÊN QUÁN CŨ',
    'NGUYÊN QUÁN MỚI',
    'ĐỊA CHỈ THƯỜNG TRÚ',
    'ĐỊA CHỈ HIỆN TẠI',
    'SỐ ĐIỆN THOẠI',
    'TRÌNH ĐỘ',
    'CHUYÊN NGÀNH',
    'MÔ TẢ CÔNG VIỆC',
    'TUỔI',
    'NGÀY NGHỈ'
  ]);

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

  function integer_(value, field, minimum, maximum) {
    var parsed = Number(value);
    assert_(
      isFinite(parsed) && Math.floor(parsed) === parsed,
      'HR_EXPORT_PERIOD_INVALID',
      field + ' phải là số nguyên.',
      { field: field }
    );
    assert_(
      parsed >= minimum && parsed <= maximum,
      'HR_EXPORT_PERIOD_INVALID',
      field + ' nằm ngoài phạm vi cho phép.',
      { field: field, minimum: minimum, maximum: maximum }
    );
    return parsed;
  }

  function pad2_(value) {
    return String(value).padStart(2, '0');
  }

  function daysInMonth_(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function validatePeriod_(year, month) {
    var safeYear = integer_(year, 'Năm', 2000, 2100);
    var safeMonth = integer_(month, 'Tháng', 1, 12);
    var prefix = safeYear + '-' + pad2_(safeMonth);
    return Object.freeze({
      year: safeYear,
      month: safeMonth,
      start: prefix + '-01',
      end: prefix + '-' + pad2_(daysInMonth_(safeYear, safeMonth)),
      key: prefix,
      label: 'tháng ' + safeMonth + '/' + safeYear,
      rosterSheetName: 'T' + safeMonth + '-' + String(safeYear).slice(-2)
    });
  }

  function all_(tableName) {
    var result = HrSheetStore.list(tableName);
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.items)) return result.items;
    return [];
  }

  function activeRow_(row) {
    return row && row.record_status !== 'DELETED' && row.record_status !== 'ARCHIVED';
  }

  function mapBy_(rows, key) {
    var result = {};
    rows.forEach(function (row) {
      if (row && row[key]) result[row[key]] = row;
    });
    return result;
  }

  function text_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function safeSheetCell_(value) {
    if (typeof value !== 'string') return value;
    // SpreadsheetApp treats strings beginning with "=" as formulas. Prefix
    // every formula-like text value so imported HR data can never execute in
    // the temporary workbook or remain executable in the downloaded XLSX.
    return /^[\s]*[=+\-@\t\r\n]/.test(value) ? "'" + value : value;
  }

  function numberOrBlank_(value) {
    if (value === null || value === undefined || value === '') return '';
    var result = Number(value);
    return isFinite(result) ? result : '';
  }

  function positiveOrder_(value) {
    var result = Number(value);
    return isFinite(result) && result > 0 ? result : null;
  }

  function sumOrBlank_(left, right) {
    var hasLeft = left !== null && left !== undefined && left !== '' && isFinite(Number(left));
    var hasRight = right !== null && right !== undefined && right !== '' && isFinite(Number(right));
    if (!hasLeft && !hasRight) return '';
    return (hasLeft ? Number(left) : 0) + (hasRight ? Number(right) : 0);
  }

  function parseDate_(value) {
    var text = text_(value);
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return { year: year, month: month, day: day, date: date };
  }

  function displayDate_(value) {
    var parsed = parseDate_(value);
    return parsed ? pad2_(parsed.day) + '/' + pad2_(parsed.month) + '/' + parsed.year : '';
  }

  function age_(birthDate, asOfDate) {
    var birth = parseDate_(birthDate);
    var asOf = parseDate_(asOfDate);
    if (!birth || !asOf || birth.date.getTime() > asOf.date.getTime()) return '';
    var age = asOf.year - birth.year;
    if (asOf.month < birth.month || (asOf.month === birth.month && asOf.day < birth.day)) {
      age -= 1;
    }
    return age;
  }

  function tenure_(startDate, asOfDate) {
    var start = parseDate_(startDate);
    var asOf = parseDate_(asOfDate);
    if (!start || !asOf || start.date.getTime() > asOf.date.getTime()) return '';

    function nextYear_(value) {
      var year = value.year + 1;
      var day = Math.min(value.day, daysInMonth_(year, value.month));
      return parseDate_(year + '-' + pad2_(value.month) + '-' + pad2_(day));
    }

    function nextMonth_(value) {
      var year = value.month === 12 ? value.year + 1 : value.year;
      var month = value.month === 12 ? 1 : value.month + 1;
      var day = Math.min(value.day, daysInMonth_(year, month));
      return parseDate_(year + '-' + pad2_(month) + '-' + pad2_(day));
    }

    var cursor = start;
    var years = 0;
    var next = nextYear_(cursor);
    while (next.date.getTime() <= asOf.date.getTime()) {
      cursor = next;
      years += 1;
      next = nextYear_(cursor);
    }

    var months = 0;
    next = nextMonth_(cursor);
    while (next.date.getTime() <= asOf.date.getTime()) {
      cursor = next;
      months += 1;
      next = nextMonth_(cursor);
    }

    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    var days = Math.round(
      (asOf.date.getTime() - cursor.date.getTime()) / millisecondsPerDay
    ) + 1;
    return years + ' NĂM ' + months + ' THÁNG ' + days + ' NGÀY';
  }

  function genderLabel_(value) {
    var normalized = text_(value).toUpperCase();
    if (normalized === 'MALE') return 'Nam';
    if (normalized === 'FEMALE') return 'Nữ';
    if (normalized === 'OTHER') return 'Khác';
    return '';
  }

  function contractTypeLabel_(value) {
    var normalized = text_(value).toUpperCase();
    var labels = {
      INDEFINITE: 'Không xác định thời hạn',
      UNLIMITED: 'Không xác định thời hạn',
      FIXED_TERM: 'Xác định thời hạn',
      DEFINITE: 'Xác định thời hạn',
      PROBATION: 'Thử việc',
      SEASONAL: 'Theo mùa vụ'
    };
    return labels[normalized] || text_(value);
  }

  function metadataObject_(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch (ignored) {
      return {};
    }
  }

  function periodFromLegacySheetName_(value) {
    var match = /^T\s*(\d{1,2})\s*[-_/]\s*(\d{2}|\d{4})$/i.exec(text_(value));
    if (!match) return null;
    var month = Number(match[1]);
    var year = Number(match[2]);
    if (match[2].length === 2) year += 2000;
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
    return year + '-' + pad2_(month);
  }

  function normalizedBaselinePeriod_(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(text_(value));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return year + '-' + pad2_(month);
  }

  function legacyBaselinePeriod_(employees) {
    var hasLegacyEmployees = Object.keys(employees).some(function (employeeId) {
      return text_(employees[employeeId].legacy_system).toUpperCase() ===
        'LEGACY_WORKFORCE_SHEET';
    });
    if (!hasLegacyEmployees) return null;

    var baseline = null;
    all_(HrSchema.TABLES.AUDIT_LOGS).forEach(function (row) {
      if (row.action !== 'LEGACY_WORKFORCE_IMPORT_CONFIRMED' ||
          row.result !== 'SUCCESS') return;
      var metadata = metadataObject_(row.sanitized_metadata_json);
      var candidate = normalizedBaselinePeriod_(metadata.baseline_period) ||
        periodFromLegacySheetName_(metadata.source_sheet_name);
      // Use the latest imported snapshot as the conservative lower bound. The
      // canonical store does not retain per-field history before that snapshot.
      if (candidate && (!baseline || candidate > baseline)) baseline = candidate;
    });
    assert_(
      baseline,
      'HR_EXPORT_BASELINE_UNKNOWN',
      'Không xác định được kỳ dữ liệu nền; chưa thể xuất báo cáo lịch sử.'
    );
    return baseline;
  }

  function fullLiveRoster_(asOfDate) {
    var items = [];
    var pageNumber = 1;
    var totalPages = 1;
    do {
      var page = HrWorkforceService.liveRoster(asOfDate, {
        page: pageNumber,
        pageSize: 500
      });
      var pageItems = page && Array.isArray(page.items) ? page.items : [];
      items = items.concat(pageItems);
      totalPages = Math.max(Number(page && page.totalPages) || 1, 1);
      assert_(
        totalPages <= 100 && items.length <= MAX_ROSTER_ROWS_,
        'HR_EXPORT_ROSTER_TOO_LARGE',
        'Danh sách nhân sự vượt giới hạn xuất báo cáo.',
        { maximum: MAX_ROSTER_ROWS_ }
      );
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return items;
  }

  function movementRows_(period, employees, departments) {
    var movements = all_(HrSchema.TABLES.WORKFORCE_MOVEMENTS).filter(function (row) {
      return activeRow_(row) &&
        row.movement_status === 'CONFIRMED' &&
        (row.movement_type === 'INCREASE' || row.movement_type === 'DECREASE') &&
        row.effective_date >= period.start &&
        row.effective_date <= period.end;
    });
    assert_(
      movements.length <= MAX_MOVEMENT_ROWS_,
      'HR_EXPORT_MOVEMENTS_TOO_LARGE',
      'Số biến động trong kỳ vượt giới hạn xuất báo cáo.',
      { maximum: MAX_MOVEMENT_ROWS_ }
    );
    movements.sort(function (left, right) {
      var byDate = text_(left.effective_date).localeCompare(text_(right.effective_date));
      if (byDate) return byDate;
      return text_(left.created_at).localeCompare(text_(right.created_at));
    });

    var increase = [];
    var decrease = [];
    movements.forEach(function (movement) {
      var employee = employees[movement.employee_id] || {};
      if (movement.movement_type === 'INCREASE') {
        increase.push([
          period.month,
          increase.length + 1,
          text_(employee.employee_code),
          text_(employee.full_name),
          displayDate_(employee.date_of_birth),
          text_(employee.contract_number),
          displayDate_(movement.decision_date || movement.effective_date),
          text_((departments[movement.to_department_id] || {}).name),
          numberOrBlank_(employee.base_salary),
          text_(employee.social_insurance_number),
          '',
          text_(movement.reason)
        ]);
      } else {
        decrease.push([
          pad2_(period.month),
          decrease.length + 1,
          text_(employee.employee_code),
          text_(employee.full_name),
          displayDate_(employee.date_of_birth),
          displayDate_(employee.hire_date),
          text_(movement.decision_number),
          displayDate_(movement.decision_date || movement.effective_date),
          text_((departments[movement.from_department_id] || {}).name),
          text_(movement.reason)
        ]);
      }
    });
    return { increase: increase, decrease: decrease };
  }

  function rosterRows_(period, liveItems, employees, departments, positions, conditions) {
    liveItems.sort(function (left, right) {
      var leftDepartment = departments[left.department_id] || {};
      var rightDepartment = departments[right.department_id] || {};
      var order = (Number(leftDepartment.sort_order) || 0) - (Number(rightDepartment.sort_order) || 0);
      if (order) return order;
      order = text_(leftDepartment.name).localeCompare(text_(rightDepartment.name), 'vi');
      if (order) return order;
      var leftEmployee = employees[left.employee_id] || {};
      var rightEmployee = employees[right.employee_id] || {};
      var leftDepartmentOrder = positiveOrder_(leftEmployee.department_display_order);
      var rightDepartmentOrder = positiveOrder_(rightEmployee.department_display_order);
      if (leftDepartmentOrder !== null || rightDepartmentOrder !== null) {
        order = (leftDepartmentOrder === null ? Number.MAX_SAFE_INTEGER : leftDepartmentOrder) -
          (rightDepartmentOrder === null ? Number.MAX_SAFE_INTEGER : rightDepartmentOrder);
        if (order) return order;
      }
      var leftDisplayOrder = positiveOrder_(leftEmployee.display_order);
      var rightDisplayOrder = positiveOrder_(rightEmployee.display_order);
      if (leftDisplayOrder !== null || rightDisplayOrder !== null) {
        order = (leftDisplayOrder === null ? Number.MAX_SAFE_INTEGER : leftDisplayOrder) -
          (rightDisplayOrder === null ? Number.MAX_SAFE_INTEGER : rightDisplayOrder);
        if (order) return order;
      }
      return text_(left.employee_code).localeCompare(text_(right.employee_code), 'vi');
    });

    var departmentCounters = {};
    return liveItems.map(function (item, index) {
      var employee = employees[item.employee_id] || {};
      var department = departments[item.department_id] || {};
      var position = positions[item.position_id] || {};
      var condition = conditions[item.working_condition_id] || {};
      var departmentKey = item.department_id || '__KHONG_PHONG_BAN__';
      departmentCounters[departmentKey] = (departmentCounters[departmentKey] || 0) + 1;
      var hireDate = employee.hire_date;
      return [
        index + 1,
        departmentCounters[departmentKey],
        text_(employee.employee_code || item.employee_code),
        text_(employee.social_insurance_number),
        text_(employee.full_name || item.full_name),
        text_(employee.health_insurance_number),
        numberOrBlank_(employee.base_salary),
        numberOrBlank_(employee.allowance),
        sumOrBlank_(employee.base_salary, employee.allowance),
        genderLabel_(employee.gender),
        text_(employee.ethnicity),
        text_(employee.religion),
        text_(position.name),
        text_(department.name),
        displayDate_(employee.date_of_birth),
        displayDate_(hireDate),
        contractTypeLabel_(employee.contract_type_code),
        text_(employee.contract_number),
        tenure_(hireDate, period.end),
        text_(employee.legacy_identity_number),
        text_(employee.citizen_id),
        displayDate_(employee.citizen_id_issued_date),
        text_(condition.name),
        text_(employee.citizen_id_issued_place),
        text_(employee.birth_place_original),
        text_(employee.birth_place_current),
        text_(employee.permanent_address),
        text_(employee.current_address),
        text_(employee.phone),
        text_(employee.education_level),
        text_(employee.major),
        text_(employee.job_description),
        age_(employee.date_of_birth, period.end),
        numberOrBlank_(employee.leave_days)
      ];
    });
  }

  function buildPlanUnlocked_(year, month) {
    var period = validatePeriod_(year, month);
    HrSheetStore.bootstrap();

    var employees = mapBy_(
      all_(HrSchema.TABLES.EMPLOYEES).filter(activeRow_),
      'employee_id'
    );
    var departments = mapBy_(
      all_(HrSchema.TABLES.DEPARTMENTS).filter(activeRow_),
      'department_id'
    );
    var positions = mapBy_(
      all_(HrSchema.TABLES.POSITIONS).filter(activeRow_),
      'position_id'
    );
    var conditions = mapBy_(
      all_(HrSchema.TABLES.WORKING_CONDITIONS).filter(activeRow_),
      'working_condition_id'
    );
    var baselinePeriod = legacyBaselinePeriod_(employees);
    assert_(
      !baselinePeriod || period.key >= baselinePeriod,
      'HR_EXPORT_BEFORE_BASELINE',
      'Không thể xuất báo cáo trước kỳ dữ liệu nền ' + baselinePeriod + '.',
      { baselinePeriod: baselinePeriod }
    );
    var liveItems = fullLiveRoster_(period.end).filter(function (item) {
      var employee = employees[item.employee_id];
      if (!employee) return false;
      return !employee.hire_date || employee.hire_date <= period.end;
    });
    var movementRows = movementRows_(period, employees, departments);
    var rosterRows = rosterRows_(
      period,
      liveItems,
      employees,
      departments,
      positions,
      conditions
    );

    var sheets = [
      {
        name: SHEET_NAMES_[0],
        title: 'DANH SÁCH TĂNG NHÂN SỰ ' + period.label.toUpperCase(),
        headers: INCREASE_HEADERS_.slice(),
        rows: movementRows.increase,
        moneyColumns: [9]
      },
      {
        name: SHEET_NAMES_[1],
        title: 'DANH SÁCH GIẢM NHÂN SỰ ' + period.label.toUpperCase(),
        headers: DECREASE_HEADERS_.slice(),
        rows: movementRows.decrease,
        moneyColumns: []
      },
      {
        name: period.rosterSheetName,
        title: 'DANH SÁCH NHÂN SỰ ' + period.label.toUpperCase(),
        headers: ROSTER_HEADERS_.slice(),
        rows: rosterRows,
        moneyColumns: [7, 8, 9]
      }
    ];
    return {
      period: period,
      baselinePeriod: baselinePeriod,
      fileName: 'bao-cao-nhan-su-' + period.rosterSheetName + '.xlsx',
      sheets: sheets,
      counts: {
        increase: movementRows.increase.length,
        decrease: movementRows.decrease.length,
        roster: rosterRows.length
      }
    };
  }

  function buildPlan(year, month) {
    assert_(
      typeof HrSheetStore !== 'undefined' &&
        typeof HrSheetStore.withLock === 'function',
      'HR_EXPORT_LOCK_UNAVAILABLE',
      'Không thể khóa dữ liệu để tạo báo cáo nhất quán.'
    );
    return HrSheetStore.withLock(function () {
      return buildPlanUnlocked_(year, month);
    });
  }

  function ensureCapacity_(sheet, rowCount, columnCount) {
    if (sheet.getMaxRows() < rowCount) {
      sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
    }
    if (sheet.getMaxColumns() < columnCount) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
    }
  }

  function blankRow_(columnCount) {
    var result = [];
    for (var index = 0; index < columnCount; index += 1) result.push('');
    return result;
  }

  function renderSheet_(sheet, definition) {
    var columnCount = definition.headers.length;
    var values = [];
    var title = blankRow_(columnCount);
    title[0] = definition.title;
    values.push(title);
    var periodRow = blankRow_(columnCount);
    periodRow[0] = 'Kỳ báo cáo';
    periodRow[1] = definition.name;
    values.push(periodRow);
    values.push(blankRow_(columnCount));
    values.push(definition.headers.slice());
    definition.rows.forEach(function (row) {
      assert_(
        row.length === columnCount,
        'HR_EXPORT_ROW_SHAPE_INVALID',
        'Dữ liệu báo cáo không khớp cấu trúc cột.'
      );
      values.push(row.slice());
    });

    ensureCapacity_(sheet, values.length, columnCount);
    var safeValues = values.map(function (row) {
      return row.map(safeSheetCell_);
    });
    sheet.getRange(1, 1, safeValues.length, columnCount).setValues(safeValues);
    sheet.getRange(1, 1, 1, columnCount)
      .merge()
      .setFontWeight('bold')
      .setFontSize(14)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.getRange(4, 1, 1, columnCount)
      .setFontWeight('bold')
      .setBackground('#0070c0')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
    if (definition.rows.length) {
      sheet.getRange(5, 1, definition.rows.length, columnCount)
        .setVerticalAlignment('middle')
        .setWrap(true);
    }
    definition.moneyColumns.forEach(function (column) {
      if (definition.rows.length) {
        sheet.getRange(5, column, definition.rows.length, 1)
          .setNumberFormat('#,##0');
      }
    });
    sheet.getRange(4, 1, Math.max(definition.rows.length + 1, 1), columnCount)
      .createFilter();
    sheet.setFrozenRows(4);
    sheet.setRowHeight(1, 28);
    sheet.autoResizeColumns(1, columnCount);
    for (var column = 1; column <= columnCount; column += 1) {
      var width = sheet.getColumnWidth(column);
      sheet.setColumnWidth(column, Math.min(Math.max(width, 80), 240));
    }
  }

  function assertExportRuntime_() {
    assert_(
      typeof SpreadsheetApp !== 'undefined' &&
        typeof SpreadsheetApp.create === 'function' &&
        typeof SpreadsheetApp.flush === 'function',
      'HR_EXPORT_RUNTIME_UNAVAILABLE',
      'Không thể tạo bảng tính báo cáo trong môi trường hiện tại.'
    );
    assert_(
      typeof DriveApp !== 'undefined' && typeof DriveApp.getFileById === 'function',
      'HR_EXPORT_DRIVE_UNAVAILABLE',
      'Không thể kiểm tra quyền riêng tư của file báo cáo.'
    );
    assert_(
      typeof Drive !== 'undefined' &&
        Drive.Files &&
        typeof Drive.Files.export === 'function',
      'HR_EXPORT_DRIVE_V3_REQUIRED',
      'Cần bật Advanced Drive Service v3 để xuất file XLSX.'
    );
    assert_(
      typeof Utilities !== 'undefined' && typeof Utilities.base64Encode === 'function',
      'HR_EXPORT_RUNTIME_UNAVAILABLE',
      'Không thể mã hóa file báo cáo trong môi trường hiện tại.'
    );
  }

  function renderTemporaryWorkbook_(spreadsheet, plan) {
    spreadsheet.setSpreadsheetLocale('vi_VN');
    spreadsheet.setSpreadsheetTimeZone(
      typeof HrConfig !== 'undefined'
        ? HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh')
        : 'Asia/Ho_Chi_Minh'
    );
    var first = spreadsheet.getSheets()[0];
    first.setName(plan.sheets[0].name);
    renderSheet_(first, plan.sheets[0]);
    for (var index = 1; index < plan.sheets.length; index += 1) {
      renderSheet_(spreadsheet.insertSheet(plan.sheets[index].name), plan.sheets[index]);
    }
    assert_(
      spreadsheet.getSheets().length === 3,
      'HR_EXPORT_SHEET_PLAN_INVALID',
      'Báo cáo tháng phải có đúng ba bảng dữ liệu.'
    );
  }

  function assertPrivateFile_(file) {
    file.setShareableByEditors(false);
    assert_(
      file.getSharingAccess() === DriveApp.Access.PRIVATE,
      'HR_EXPORT_TEMP_FILE_NOT_PRIVATE',
      'File báo cáo tạm thời không ở chế độ riêng tư.'
    );
  }

  function exportMonth(year, month) {
    var plan = buildPlan(year, month);
    assertExportRuntime_();
    var temporaryFile = null;
    var temporarySpreadsheetId = null;
    var operationError = null;
    var cleanupError = null;
    var result = null;
    try {
      var spreadsheet = SpreadsheetApp.create('Báo cáo nhân sự tạm thời ' + plan.period.key);
      temporarySpreadsheetId = spreadsheet.getId();
      // Capture the Drive handle immediately so every later failure can trash
      // the temporary spreadsheet in the finally block.
      temporaryFile = DriveApp.getFileById(temporarySpreadsheetId);
      assertPrivateFile_(temporaryFile);
      renderTemporaryWorkbook_(spreadsheet, plan);
      SpreadsheetApp.flush();
      var exported = Drive.Files.export(temporarySpreadsheetId, XLSX_MIME_);
      var blob = exported && typeof exported.getBlob === 'function'
        ? exported.getBlob()
        : exported;
      assert_(
        blob && typeof blob.getBytes === 'function',
        'HR_EXPORT_BINARY_INVALID',
        'Google Drive không trả về nội dung XLSX hợp lệ.'
      );
      var bytes = blob.getBytes();
      assert_(
        bytes.length > 0 && bytes.length <= MAX_EXPORT_BYTES_,
        'HR_EXPORT_FILE_SIZE_INVALID',
        'Kích thước file báo cáo không hợp lệ.',
        { maximumBytes: MAX_EXPORT_BYTES_ }
      );
      result = {
        fileName: plan.fileName,
        mimeType: XLSX_MIME_,
        base64: Utilities.base64Encode(bytes),
        byteLength: bytes.length,
        period: plan.period.key,
        sheetNames: plan.sheets.map(function (sheet) { return sheet.name; }),
        counts: plan.counts
      };
    } catch (error) {
      operationError = error;
    } finally {
      if (temporarySpreadsheetId) {
        try {
          var fileToTrash = temporaryFile || DriveApp.getFileById(temporarySpreadsheetId);
          fileToTrash.setTrashed(true);
        } catch (driveAppCleanupError) {
          if (Drive.Files && typeof Drive.Files.update === 'function') {
            try {
              Drive.Files.update({ trashed: true }, temporarySpreadsheetId);
            } catch (driveV3CleanupError) {
              cleanupError = driveV3CleanupError;
            }
          } else {
            cleanupError = driveAppCleanupError;
          }
        }
      }
    }

    if (cleanupError) {
      fail_(
        'HR_EXPORT_CLEANUP_FAILED',
        'Không thể xóa file báo cáo tạm thời; thao tác xuất đã bị dừng.'
      );
    }
    if (operationError) {
      if (operationError.name === 'HrSafeError') {
        throw operationError;
      }
      fail_('HR_EXPORT_FAILED', 'Không thể tạo file báo cáo nhân sự tháng.');
    }
    return result;
  }

  return Object.freeze({
    buildPlan: buildPlan,
    exportMonth: exportMonth
  });
})();

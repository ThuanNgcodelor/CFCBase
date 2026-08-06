var LeaveConfig = (function () {
  'use strict';

  var TABLES = {
    CONFIG: 'CONFIG',
    DEPARTMENTS: 'DEPARTMENTS',
    DEPARTMENT_HEADS: 'DEPARTMENT_HEADS',
    EMPLOYEES: 'LEAVE_EMPLOYEES',
    REQUESTS: 'LEAVE_REQUESTS',
    ADJUSTMENTS: 'LEAVE_ADJUSTMENTS',
    APPROVAL_LOGS: 'APPROVAL_LOGS',
    IMPORT_LOGS: 'IMPORT_LOGS'
  };

  var HEADERS = {};
  HEADERS[TABLES.CONFIG] = ['key', 'value', 'note'];
  HEADERS[TABLES.DEPARTMENTS] = ['department', 'head_name', 'note', 'updated_at'];
  HEADERS[TABLES.DEPARTMENT_HEADS] = ['department', 'head_name', 'email', 'active', 'note', 'updated_at'];
  HEADERS[TABLES.EMPLOYEES] = [
    'employee_code',
    'full_name',
    'department',
    'position',
    'hire_date',
    'working_condition',
    'service_years',
    'annual_leave_days',
    'used_days',
    'pending_days',
    'remaining_days',
    'period',
    'source_sheet',
    'updated_at'
  ];
  HEADERS[TABLES.REQUESTS] = [
    'request_id',
    'employee_code',
    'full_name',
    'department',
    'leave_from',
    'leave_to',
    'day_count',
    'reason',
    'requested_by',
    'status',
    'manager_note',
    'approved_by',
    'approved_at',
    'created_at',
    'updated_at'
  ];
  HEADERS[TABLES.ADJUSTMENTS] = [
    'adjustment_id',
    'employee_code',
    'full_name',
    'department',
    'period',
    'before_days',
    'after_days',
    'delta_days',
    'reason',
    'adjusted_by',
    'created_at'
  ];
  HEADERS[TABLES.APPROVAL_LOGS] = [
    'log_id',
    'entity_type',
    'entity_id',
    'action',
    'actor',
    'note',
    'created_at'
  ];
  HEADERS[TABLES.IMPORT_LOGS] = [
    'import_id',
    'source_sheet',
    'period',
    'imported_rows',
    'imported_by',
    'created_at',
    'note'
  ];

  function header(tableName) {
    return HEADERS[tableName].slice();
  }

  function now() {
    return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  }

  function uuid(prefix) {
    return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  }

  return {
    TABLES: TABLES,
    header: header,
    now: now,
    uuid: uuid
  };
}());

var LeaveCache = (function () {
  'use strict';

  var VERSION_KEY = 'LEAVE_CACHE_VERSION';
  var CHUNK_SIZE = 85000;
  var DEFAULT_TTL_SECONDS = 300;

  function cache_() {
    try {
      return CacheService.getScriptCache();
    } catch (error) {
      return null;
    }
  }

  function properties_() {
    try {
      return PropertiesService.getScriptProperties();
    } catch (error) {
      return null;
    }
  }

  function version_() {
    var properties = properties_();
    return properties && properties.getProperty(VERSION_KEY) || '1';
  }

  function key_(name) {
    return ['leave', version_(), name].join(':');
  }

  function getJson(name) {
    var cache = cache_();
    if (!cache) return null;
    var key = key_(name);
    var metaText = cache.get(key + ':meta');
    if (!metaText) return null;
    try {
      var meta = JSON.parse(metaText);
      var parts = [];
      for (var i = 0; i < meta.chunks; i += 1) {
        var part = cache.get(key + ':' + i);
        if (part === null) return null;
        parts.push(part);
      }
      return JSON.parse(parts.join(''));
    } catch (error) {
      return null;
    }
  }

  function putJson(name, value, ttlSeconds) {
    var cache = cache_();
    if (!cache) return;
    var key = key_(name);
    var text = JSON.stringify(value);
    var chunks = Math.ceil(text.length / CHUNK_SIZE) || 1;
    var values = {};
    values[key + ':meta'] = JSON.stringify({ chunks: chunks });
    for (var i = 0; i < chunks; i += 1) {
      values[key + ':' + i] = text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    }
    try {
      cache.putAll(values, ttlSeconds || DEFAULT_TTL_SECONDS);
    } catch (error) {
      return;
    }
  }

  function remember(name, producer, ttlSeconds) {
    var cached = getJson(name);
    if (cached !== null) return cached;
    var value = producer();
    putJson(name, value, ttlSeconds);
    return value;
  }

  function invalidate() {
    var properties = properties_();
    if (!properties) return;
    properties.setProperty(VERSION_KEY, String(Date.now()));
  }

  return {
    remember: remember,
    invalidate: invalidate
  };
}());

var LeaveStore = (function () {
  'use strict';

  function spreadsheet_() {
    var configured = PropertiesService.getScriptProperties().getProperty('PRIMARY_SPREADSHEET_ID');
    if (configured) return SpreadsheetApp.openById(configured);
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function sheet_(tableName) {
    var ss = spreadsheet_();
    var sheet = ss.getSheetByName(tableName);
    if (!sheet) sheet = ss.insertSheet(tableName);
    ensureHeader_(sheet, LeaveConfig.header(tableName));
    return sheet;
  }

  function ensureHeader_(sheet, header) {
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      sheet.setFrozenRows(1);
      formatHeader_(sheet, header.length);
      return;
    }
    var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), header.length)).getValues()[0];
    var next = current.slice();
    header.forEach(function (name) {
      if (next.indexOf(name) === -1) next.push(name);
    });
    sheet.getRange(1, 1, 1, next.length).setValues([next]);
    sheet.setFrozenRows(1);
    formatHeader_(sheet, next.length);
  }

  function formatHeader_(sheet, columnCount) {
    sheet.getRange(1, 1, 1, columnCount)
      .setFontWeight('bold')
      .setBackground('#0f766e')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.autoResizeColumns(1, columnCount);
  }

  function headers_(sheet) {
    if (sheet.getLastColumn() === 0) return [];
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  }

  function all(tableName) {
    return LeaveCache.remember('table:' + tableName, function () {
      var sheet = sheet_(tableName);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      var header = headers_(sheet);
      return sheet.getRange(2, 1, lastRow - 1, header.length).getValues().map(function (row, index) {
        var item = { _row: index + 2 };
        header.forEach(function (name, columnIndex) {
          item[name] = row[columnIndex];
        });
        return item;
      }).filter(function (row) {
        return Object.keys(row).some(function (key) {
          return key !== '_row' && row[key] !== '' && row[key] !== null;
        });
      });
    }, tableName === LeaveConfig.TABLES.DEPARTMENT_HEADS ? 60 : 300);
  }

  function replaceAll(tableName, rows) {
    var sheet = sheet_(tableName);
    var header = headers_(sheet);
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 1)).clearContent();
    }
    if (!rows.length) {
      LeaveCache.invalidate();
      return;
    }
    var values = rows.map(function (row) {
      return header.map(function (name) {
        return row[name] === undefined || row[name] === null ? '' : row[name];
      });
    });
    sheet.getRange(2, 1, values.length, header.length).setValues(values);
    sheet.autoResizeColumns(1, header.length);
    LeaveCache.invalidate();
  }

  function append(tableName, row) {
    var sheet = sheet_(tableName);
    var header = headers_(sheet);
    sheet.appendRow(header.map(function (name) {
      return row[name] === undefined || row[name] === null ? '' : row[name];
    }));
    sheet.autoResizeColumns(1, header.length);
    LeaveCache.invalidate();
    return row;
  }

  function patchById(tableName, idColumn, id, patch) {
    var sheet = sheet_(tableName);
    var header = headers_(sheet);
    var idIndex = header.indexOf(idColumn);
    if (idIndex < 0) throw new Error('Missing id column: ' + idColumn);
    var values = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getValues()
      : [];
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][idIndex]) === String(id)) {
        Object.keys(patch).forEach(function (key) {
          var columnIndex = header.indexOf(key);
          if (columnIndex >= 0) values[i][columnIndex] = patch[key];
        });
        sheet.getRange(i + 2, 1, 1, header.length).setValues([values[i]]);
        LeaveCache.invalidate();
        return true;
      }
    }
    return false;
  }

  return {
    spreadsheet: spreadsheet_,
    sheet: sheet_,
    all: all,
    replaceAll: replaceAll,
    append: append,
    patchById: patchById
  };
}());

var LeaveService = (function () {
  'use strict';

  function normalizeText_(value) {
    var text = String(value || '').trim().toLowerCase();
    if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.replace(/\s+/g, ' ');
  }

  function email_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function active_(value) {
    var text = String(value === undefined || value === null ? 'TRUE' : value).trim().toUpperCase();
    return text !== 'FALSE' && text !== 'NO' && text !== '0';
  }

  function number_(value) {
    if (value === '' || value === null || value === undefined) return 0;
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function date_(value) {
    if (!value) return '';
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    }
    var text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(text)) {
      var parsed = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(text) * 86400000));
      return parsed.toISOString().slice(0, 10);
    }
    var match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return [
        match[3],
        String(match[2]).padStart(2, '0'),
        String(match[1]).padStart(2, '0')
      ].join('-');
    }
    return text;
  }

  function dateLabel_(value) {
    var text = date_(value);
    var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? [match[3], match[2], match[1]].join('/') : text;
  }

  function daysBetweenInclusive_(from, to) {
    var start = date_(from);
    var end = date_(to || from);
    if (!start || !end) return 0;
    var a = new Date(start + 'T00:00:00Z');
    var b = new Date(end + 'T00:00:00Z');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    var diff = Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
    return Math.max(diff, 0);
  }

  function setup() {
    Object.keys(LeaveConfig.TABLES).forEach(function (key) {
      LeaveStore.sheet(LeaveConfig.TABLES[key]);
    });
    var config = LeaveStore.all(LeaveConfig.TABLES.CONFIG);
    if (!config.length) {
      LeaveStore.replaceAll(LeaveConfig.TABLES.CONFIG, [
        { key: 'DEFAULT_MONTH_SHEET', value: 'T8-26', note: 'Tên sheet danh sách tháng hiện tại' },
        { key: 'PERIOD', value: 'T8-26', note: 'Kỳ phép đang quản lý' }
      ]);
    }
    syncDepartmentHeads_();
    return dashboard();
  }

  function ensureReady_() {
    Object.keys(LeaveConfig.TABLES).forEach(function (key) {
      LeaveStore.sheet(LeaveConfig.TABLES[key]);
    });
  }

  function currentUserEmail_() {
    try {
      return email_(Session.getActiveUser().getEmail());
    } catch (error) {
      return '';
    }
  }

  function departmentHeads_() {
    return LeaveStore.all(LeaveConfig.TABLES.DEPARTMENT_HEADS).filter(function (row) {
      return row.department && row.email && active_(row.active);
    }).map(function (row) {
      row.email = email_(row.email);
      return row;
    });
  }

  function headsForDepartment_(department) {
    var normalized = normalizeText_(department);
    return departmentHeads_().filter(function (row) {
      return normalizeText_(row.department) === normalized || normalizeText_(row.department) === 'all';
    });
  }

  function approverContext_() {
    var email = currentUserEmail_();
    var heads = departmentHeads_().filter(function (row) {
      return email && email_(row.email) === email;
    });
    var isAdmin = heads.some(function (row) {
      return normalizeText_(row.department) === 'all';
    });
    return {
      email: email,
      authorized: heads.length > 0,
      isAdmin: isAdmin,
      departments: isAdmin ? departments() : heads.map(function (row) { return row.department; }).sort(),
      heads: heads
    };
  }

  function assertApprover_(department) {
    var context = approverContext_();
    if (!context.email) throw new Error('Không lấy được email Google. Hãy deploy Web app yêu cầu người dùng đăng nhập Google.');
    if (!context.authorized) throw new Error('Email này chưa có quyền duyệt ngày nghỉ.');
    if (!context.isAdmin && department) {
      var allowed = context.departments.some(function (value) {
        return normalizeText_(value) === normalizeText_(department);
      });
      if (!allowed) throw new Error('Bạn không có quyền duyệt phòng ban này.');
    }
    return context;
  }

  function syncDepartmentHeads_() {
    var existing = LeaveStore.all(LeaveConfig.TABLES.DEPARTMENT_HEADS);
    if (existing.length) return;
    var rows = departments().map(function (department) {
      return {
        department: department,
        head_name: '',
        email: '',
        active: 'TRUE',
        note: 'Nhập email trưởng phòng để duyệt và nhận thông báo',
        updated_at: LeaveConfig.now()
      };
    });
    rows.unshift({
      department: 'ALL',
      head_name: 'Quản lý tổng',
      email: '',
      active: 'TRUE',
      note: 'Điền email quản lý tổng nếu muốn duyệt tất cả phòng ban',
      updated_at: LeaveConfig.now()
    });
    LeaveStore.replaceAll(LeaveConfig.TABLES.DEPARTMENT_HEADS, rows);
  }

  function columnMap_(headerRow) {
    var aliases = {
      employeeCode: ['ma so', 'ma nhan su', 'mã số'],
      fullName: ['ho va ten', 'họ và tên'],
      department: ['don vi cong tac', 'đơn vị công tác'],
      position: ['chuc vu', 'chức vụ'],
      hireDate: ['ngay lam', 'ngày làm'],
      workingCondition: ['moi truong lam viec', 'môi trường làm việc'],
      serviceYears: ['nam cong tac', 'năm công tác'],
      annualLeaveDays: ['ngay nghi phep', 'ngày nghỉ phép']
    };
    var normalized = headerRow.map(normalizeText_);
    var result = {};
    Object.keys(aliases).forEach(function (key) {
      aliases[key].some(function (alias) {
        var index = normalized.indexOf(normalizeText_(alias));
        if (index >= 0) {
          result[key] = index;
          return true;
        }
        return false;
      });
    });
    return result;
  }

  function findHeaderRow_(values) {
    for (var i = 0; i < Math.min(values.length, 20); i += 1) {
      var row = values[i].map(normalizeText_);
      if (row.indexOf('ho va ten') >= 0 && row.indexOf('ngay nghi phep') >= 0) return i;
    }
    throw new Error('Không tìm thấy header có HỌ VÀ TÊN và NGÀY NGHỈ PHÉP.');
  }

  function importMonthlyRoster(options) {
    options = options || {};
    var sourceSheetName = options.sourceSheetName || options.sheetName || 'T8-26';
    var period = options.period || sourceSheetName;
    var importedBy = options.importedBy || '';
    var sourceSheet = LeaveStore.spreadsheet().getSheetByName(sourceSheetName);
    if (!sourceSheet) throw new Error('Không tìm thấy sheet nguồn: ' + sourceSheetName);
    var values = sourceSheet.getDataRange().getValues();
    var headerRowIndex = findHeaderRow_(values);
    var map = columnMap_(values[headerRowIndex]);
    ['employeeCode', 'fullName', 'department', 'annualLeaveDays'].forEach(function (key) {
      if (map[key] === undefined) throw new Error('Thiếu cột bắt buộc: ' + key);
    });

    var rows = [];
    var departments = {};
    for (var i = headerRowIndex + 1; i < values.length; i += 1) {
      var row = values[i];
      var employeeCode = String(row[map.employeeCode] || '').trim();
      var fullName = String(row[map.fullName] || '').trim();
      var department = String(row[map.department] || '').trim();
      if (!employeeCode || !fullName) continue;
      departments[department] = true;
      rows.push({
        employee_code: employeeCode,
        full_name: fullName,
        department: department,
        position: map.position === undefined ? '' : row[map.position],
        hire_date: map.hireDate === undefined ? '' : date_(row[map.hireDate]),
        working_condition: map.workingCondition === undefined ? '' : row[map.workingCondition],
        service_years: map.serviceYears === undefined ? '' : row[map.serviceYears],
        annual_leave_days: number_(row[map.annualLeaveDays]),
        used_days: 0,
        pending_days: 0,
        remaining_days: number_(row[map.annualLeaveDays]),
        period: period,
        source_sheet: sourceSheetName,
        updated_at: LeaveConfig.now()
      });
    }
    LeaveStore.replaceAll(LeaveConfig.TABLES.EMPLOYEES, recalculate_(rows));
    LeaveStore.replaceAll(LeaveConfig.TABLES.DEPARTMENTS, Object.keys(departments).sort().map(function (department) {
      return { department: department, head_name: '', note: '', updated_at: LeaveConfig.now() };
    }));
    syncDepartmentHeads_();
    LeaveStore.append(LeaveConfig.TABLES.IMPORT_LOGS, {
      import_id: LeaveConfig.uuid('IMP'),
      source_sheet: sourceSheetName,
      period: period,
      imported_rows: rows.length,
      imported_by: importedBy,
      created_at: LeaveConfig.now(),
      note: 'Imported sanitized leave roster'
    });
    return dashboard();
  }

  function approvedRequests_() {
    return LeaveStore.all(LeaveConfig.TABLES.REQUESTS).filter(function (row) {
      return String(row.status || '').toUpperCase() === 'APPROVED';
    });
  }

  function pendingRequests_() {
    return LeaveStore.all(LeaveConfig.TABLES.REQUESTS).filter(function (row) {
      return String(row.status || '').toUpperCase() === 'PENDING';
    });
  }

  function recalculate_(employees) {
    employees = employees || LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES);
    var used = {};
    var pending = {};
    approvedRequests_().forEach(function (request) {
      used[request.employee_code] = (used[request.employee_code] || 0) + number_(request.day_count);
    });
    pendingRequests_().forEach(function (request) {
      pending[request.employee_code] = (pending[request.employee_code] || 0) + number_(request.day_count);
    });
    return employees.map(function (employee) {
      var annual = number_(employee.annual_leave_days);
      var usedDays = used[employee.employee_code] || 0;
      var pendingDays = pending[employee.employee_code] || 0;
      employee.used_days = usedDays;
      employee.pending_days = pendingDays;
      employee.remaining_days = Math.round((annual - usedDays) * 100) / 100;
      employee.updated_at = LeaveConfig.now();
      return employee;
    });
  }

  function refreshBalances_() {
    LeaveStore.replaceAll(LeaveConfig.TABLES.EMPLOYEES, recalculate_());
  }

  function employees(filters) {
    filters = filters || {};
    var keyword = normalizeText_(filters.keyword);
    var department = normalizeText_(filters.department);
    return LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES).filter(function (row) {
      var haystack = normalizeText_([row.employee_code, row.full_name, row.department, row.position].join(' '));
      if (keyword && haystack.indexOf(keyword) === -1) return false;
      if (department && normalizeText_(row.department) !== department) return false;
      return true;
    }).map(function (row) {
      row.hire_date_label = dateLabel_(row.hire_date);
      return row;
    });
  }

  function requests(filters) {
    filters = filters || {};
    var status = normalizeText_(filters.status);
    var department = normalizeText_(filters.department);
    return LeaveStore.all(LeaveConfig.TABLES.REQUESTS).filter(function (row) {
      if (status && normalizeText_(row.status) !== status) return false;
      if (department && normalizeText_(row.department) !== department) return false;
      return true;
    }).map(function (row) {
      row.leave_from_label = dateLabel_(row.leave_from);
      row.leave_to_label = dateLabel_(row.leave_to);
      return row;
    });
  }

  function findEmployee_(employeeCode) {
    return LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES).filter(function (row) {
      return String(row.employee_code) === String(employeeCode);
    })[0] || null;
  }

  function createRequest(payload) {
    ensureReady_();
    payload = payload || {};
    var employee = findEmployee_(payload.employeeCode || payload.employee_code);
    if (!employee) throw new Error('Không tìm thấy nhân sự.');
    var dayCount = payload.dayCount || payload.day_count || daysBetweenInclusive_(payload.leaveFrom, payload.leaveTo);
    if (number_(dayCount) <= 0) throw new Error('Số ngày nghỉ phải lớn hơn 0.');
    var request = {
      request_id: LeaveConfig.uuid('NP'),
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      department: employee.department,
      leave_from: date_(payload.leaveFrom || payload.leave_from),
      leave_to: date_(payload.leaveTo || payload.leave_to || payload.leaveFrom || payload.leave_from),
      day_count: number_(dayCount),
      reason: payload.reason || '',
      requested_by: payload.requestedBy || payload.requested_by || '',
      status: 'PENDING',
      manager_note: '',
      approved_by: '',
      approved_at: '',
      created_at: LeaveConfig.now(),
      updated_at: LeaveConfig.now()
    };
    LeaveStore.append(LeaveConfig.TABLES.REQUESTS, request);
    notifyDepartmentHeads_(request);
    LeaveStore.append(LeaveConfig.TABLES.APPROVAL_LOGS, {
      log_id: LeaveConfig.uuid('LOG'),
      entity_type: 'LEAVE_REQUEST',
      entity_id: request.request_id,
      action: 'CREATED',
      actor: request.requested_by,
      note: request.reason,
      created_at: LeaveConfig.now()
    });
    refreshBalances_();
    return dashboard();
  }

  function notifyDepartmentHeads_(request) {
    var heads = headsForDepartment_(request.department);
    var recipients = heads.map(function (head) { return head.email; }).filter(Boolean);
    if (!recipients.length) {
      LeaveStore.append(LeaveConfig.TABLES.APPROVAL_LOGS, {
        log_id: LeaveConfig.uuid('LOG'),
        entity_type: 'LEAVE_REQUEST',
        entity_id: request.request_id,
        action: 'EMAIL_SKIPPED',
        actor: '',
        note: 'Chưa cấu hình email trưởng phòng cho ' + request.department,
        created_at: LeaveConfig.now()
      });
      return;
    }
    var subject = '[Yêu cầu nghỉ phép] ' + request.full_name + ' - ' + request.department;
    var body = [
      'Có yêu cầu nghỉ phép mới cần duyệt.',
      '',
      'Mã phiếu: ' + request.request_id,
      'Nhân sự: ' + request.employee_code + ' - ' + request.full_name,
      'Phòng ban: ' + request.department,
      'Thời gian nghỉ: ' + dateLabel_(request.leave_from) + ' - ' + dateLabel_(request.leave_to),
      'Số ngày: ' + request.day_count,
      'Lý do: ' + (request.reason || '-'),
      'Người nhập: ' + (request.requested_by || '-'),
      '',
      'Vui lòng mở app Quản lý ngày phép để duyệt.'
    ].join('\n');
    try {
      MailApp.sendEmail({
        to: recipients.join(','),
        subject: subject,
        body: body,
        name: 'Quản lý ngày phép'
      });
      LeaveStore.append(LeaveConfig.TABLES.APPROVAL_LOGS, {
        log_id: LeaveConfig.uuid('LOG'),
        entity_type: 'LEAVE_REQUEST',
        entity_id: request.request_id,
        action: 'EMAIL_SENT',
        actor: '',
        note: recipients.join(', '),
        created_at: LeaveConfig.now()
      });
    } catch (error) {
      LeaveStore.append(LeaveConfig.TABLES.APPROVAL_LOGS, {
        log_id: LeaveConfig.uuid('LOG'),
        entity_type: 'LEAVE_REQUEST',
        entity_id: request.request_id,
        action: 'EMAIL_FAILED',
        actor: '',
        note: String(error && error.message || error),
        created_at: LeaveConfig.now()
      });
    }
  }

  function approveRequest(payload) {
    ensureReady_();
    payload = payload || {};
    var status = String(payload.status || 'APPROVED').toUpperCase();
    if (['APPROVED', 'REJECTED', 'PENDING'].indexOf(status) < 0) throw new Error('Trạng thái không hợp lệ.');
    var request = LeaveStore.all(LeaveConfig.TABLES.REQUESTS).filter(function (row) {
      return String(row.request_id) === String(payload.requestId || payload.request_id);
    })[0] || null;
    if (!request) throw new Error('Không tìm thấy đề xuất nghỉ phép.');
    var approver = assertApprover_(request.department);
    var ok = LeaveStore.patchById(LeaveConfig.TABLES.REQUESTS, 'request_id', payload.requestId || payload.request_id, {
      status: status,
      manager_note: payload.managerNote || payload.manager_note || '',
      approved_by: approver.email,
      approved_at: status === 'PENDING' ? '' : LeaveConfig.now(),
      updated_at: LeaveConfig.now()
    });
    if (!ok) throw new Error('Không tìm thấy đề xuất nghỉ phép.');
    LeaveStore.append(LeaveConfig.TABLES.APPROVAL_LOGS, {
      log_id: LeaveConfig.uuid('LOG'),
      entity_type: 'LEAVE_REQUEST',
      entity_id: payload.requestId || payload.request_id,
      action: status,
      actor: approver.email,
      note: payload.managerNote || payload.manager_note || '',
      created_at: LeaveConfig.now()
    });
    refreshBalances_();
    return approverDashboard();
  }

  function adjustAnnualLeave(payload) {
    ensureReady_();
    payload = payload || {};
    var employee = findEmployee_(payload.employeeCode || payload.employee_code);
    if (!employee) throw new Error('Không tìm thấy nhân sự.');
    var approver = assertApprover_(employee.department);
    var afterDays = number_(payload.afterDays || payload.after_days);
    if (afterDays < 0) throw new Error('Số ngày phép không hợp lệ.');
    LeaveStore.patchById(LeaveConfig.TABLES.EMPLOYEES, 'employee_code', employee.employee_code, {
      annual_leave_days: afterDays,
      updated_at: LeaveConfig.now()
    });
    LeaveStore.append(LeaveConfig.TABLES.ADJUSTMENTS, {
      adjustment_id: LeaveConfig.uuid('ADJ'),
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      department: employee.department,
      period: employee.period,
      before_days: number_(employee.annual_leave_days),
      after_days: afterDays,
      delta_days: Math.round((afterDays - number_(employee.annual_leave_days)) * 100) / 100,
      reason: payload.reason || '',
      adjusted_by: approver.email,
      created_at: LeaveConfig.now()
    });
    refreshBalances_();
    return approverDashboard();
  }

  function departments() {
    var values = {};
    LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES).forEach(function (row) {
      if (row.department) values[row.department] = true;
    });
    return Object.keys(values).sort();
  }

  function dashboard() {
    ensureReady_();
    var list = LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES);
    var reqs = LeaveStore.all(LeaveConfig.TABLES.REQUESTS);
    var totalAnnual = list.reduce(function (sum, row) { return sum + number_(row.annual_leave_days); }, 0);
    var totalUsed = list.reduce(function (sum, row) { return sum + number_(row.used_days); }, 0);
    var totalPending = list.reduce(function (sum, row) { return sum + number_(row.pending_days); }, 0);
    var totalRemaining = list.reduce(function (sum, row) { return sum + number_(row.remaining_days); }, 0);
    return {
      summary: {
        employeeCount: list.length,
        totalAnnual: totalAnnual,
        totalUsed: totalUsed,
        totalPending: totalPending,
        totalRemaining: totalRemaining,
        pendingApprovals: reqs.filter(function (row) {
          return String(row.status || '').toUpperCase() === 'PENDING';
        }).length
      },
      departments: departments(),
      employees: [],
      requests: [],
      approver: {
        email: currentUserEmail_(),
        authorized: false,
        departments: []
      }
    };
  }

  function publicEmployees(filters) {
    ensureReady_();
    filters = filters || {};
    if (!filters.department) return [];
    return employees(filters);
  }

  function approverDashboard() {
    ensureReady_();
    var approver = assertApprover_();
    var allowed = {};
    approver.departments.forEach(function (department) {
      allowed[normalizeText_(department)] = true;
    });
    var filteredRequests = requests({}).filter(function (row) {
      return approver.isAdmin || allowed[normalizeText_(row.department)];
    });
    var filteredEmployees = employees({}).filter(function (row) {
      return approver.isAdmin || allowed[normalizeText_(row.department)];
    });
    return {
      approver: {
        email: approver.email,
        authorized: approver.authorized,
        isAdmin: approver.isAdmin,
        departments: approver.departments
      },
      employees: filteredEmployees,
      requests: filteredRequests
    };
  }

  function exportCsv() {
    var header = [
      'Mã số',
      'Họ và tên',
      'Đơn vị công tác',
      'Chức vụ',
      'Ngày làm',
      'Môi trường làm việc',
      'Ngày phép năm',
      'Đã nghỉ duyệt',
      'Đang chờ duyệt',
      'Còn lại'
    ];
    var lines = [header].concat(employees({}).map(function (row) {
      return [
        row.employee_code,
        row.full_name,
        row.department,
        row.position,
        row.hire_date_label,
        row.working_condition,
        row.annual_leave_days,
        row.used_days,
        row.pending_days,
        row.remaining_days
      ];
    }));
    return lines.map(function (line) {
      return line.map(function (cell) {
        return '"' + String(cell === undefined || cell === null ? '' : cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
  }

  return {
    setup: setup,
    importMonthlyRoster: importMonthlyRoster,
    dashboard: dashboard,
    publicEmployees: publicEmployees,
    approverDashboard: approverDashboard,
    employees: employees,
    requests: requests,
    createRequest: createRequest,
    approveRequest: approveRequest,
    adjustAnnualLeave: adjustAnnualLeave,
    exportCsv: exportCsv
  };
}());

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Quản lý ngày phép')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupLeaveWorkbook() {
  return LeaveService.setup();
}

function clearLeaveCache() {
  LeaveCache.invalidate();
  return { ok: true, clearedAt: LeaveConfig.now() };
}

function importMonthlyRoster(payload) {
  return LeaveService.importMonthlyRoster(payload || {});
}

function getLeaveDashboard() {
  return LeaveService.dashboard();
}

function getLeaveEmployees(payload) {
  return LeaveService.publicEmployees(payload || {});
}

function getApproverDashboard() {
  return LeaveService.approverDashboard();
}

function createLeaveRequest(payload) {
  return LeaveService.createRequest(payload || {});
}

function approveLeaveRequest(payload) {
  return LeaveService.approveRequest(payload || {});
}

function adjustAnnualLeave(payload) {
  return LeaveService.adjustAnnualLeave(payload || {});
}

function exportLeaveCsv() {
  return LeaveService.exportCsv();
}

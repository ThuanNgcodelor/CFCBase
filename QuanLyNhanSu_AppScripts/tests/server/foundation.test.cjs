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
    const values = [];
    for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset += 1) {
      const row = [];
      for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset += 1) {
        row.push(
          this.sheet.values[this.row - 1 + rowOffset]?.[this.column - 1 + columnOffset] ?? ''
        );
      }
      values.push(row);
    }
    return values;
  }

  setValues(values) {
    assert.equal(values.length, this.rowCount);
    values.forEach((sourceRow, rowOffset) => {
      assert.equal(sourceRow.length, this.columnCount);
      const targetIndex = this.row - 1 + rowOffset;
      this.sheet.values[targetIndex] ||= [];
      sourceRow.forEach((value, columnOffset) => {
        this.sheet.values[targetIndex][this.column - 1 + columnOffset] = value;
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

  insertSheet(name) {
    assert.equal(this.sheets.has(name), false);
    const sheet = new MemorySheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function loadFoundation() {
  const spreadsheet = new MemorySpreadsheet();
  const properties = new Map([
    ['APP_ENV', 'development'],
    ['MAX_PAGE_SIZE', '200']
  ]);
  let sequence = 0;
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
      }
    }
  });

  const sourceDirectory = path.resolve(__dirname, '../../src/server');
  [
    '00_Config.js',
    '01_Core.js',
    '02_Schema.js',
    '03_SheetStore.js',
    '04_AuditService.js'
  ].forEach((fileName) => {
    vm.runInContext(
      fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  return { context, spreadsheet };
}

function insertCatalogs(context) {
  const { HrSchema, HrSheetStore } = context;
  const department = HrSheetStore.insert(HrSchema.TABLES.DEPARTMENTS, {
    code: 'TCHC',
    name: 'Tổ chức hành chính'
  });
  const position = HrSheetStore.insert(HrSchema.TABLES.POSITIONS, {
    code: 'NV',
    name: 'Nhân viên'
  });
  const condition = HrSheetStore.insert(HrSchema.TABLES.WORKING_CONDITIONS, {
    code: 'NORMAL',
    name: 'Bình thường'
  });
  return { department, position, condition };
}

test('config and context use development fallback and a stable internal actor', () => {
  const { context } = loadFoundation();
  const config = context.HrConfig.validate();
  assert.equal(config.spreadsheetSource, 'ACTIVE_DEVELOPMENT');

  const first = context.HrCore.context();
  const second = context.HrCore.context();
  assert.equal(first.actor.id, second.actor.id);
  assert.equal(first.actor.type, 'INTERNAL');
  assert.notEqual(first.requestId, second.requestId);
  assert.equal('Session' in context, false);
});

test('schema registry exposes the ten MVP tables and strict validation', () => {
  const { context } = loadFoundation();
  const { HrSchema } = context;
  assert.equal(HrSchema.names().length, 10);
  assert.ok(HrSchema.headers(HrSchema.TABLES.EMPLOYEES).includes('citizen_id'));
  assert.ok(HrSchema.headers(HrSchema.TABLES.PROBATION_CANDIDATES).includes('birth_place'));
  assert.ok(HrSchema.headers(HrSchema.TABLES.GENERATED_DOCUMENTS).includes('secure_snapshot_ref'));
  assert.throws(
    () => HrSchema.prepare(HrSchema.TABLES.EMPLOYEES, { unsupported: true }, 'update'),
    (error) => error.code === 'SCHEMA_COLUMN_UNKNOWN'
  );
  assert.throws(
    () => HrSchema.prepare(
      HrSchema.TABLES.EMPLOYEES,
      { employment_status: 'NOT_A_STATUS' },
      'update'
    ),
    (error) => error.code === 'SCHEMA_ENUM_INVALID'
  );
});

test('store bootstraps, validates FKs, batches records and enforces row_version', () => {
  const { context, spreadsheet } = loadFoundation();
  const { HrSchema, HrSheetStore } = context;
  const bootstrap = HrSheetStore.bootstrap();
  assert.equal(bootstrap.created.length, 10);
  assert.equal(spreadsheet.sheets.size, 10);
  assert.equal(HrSheetStore.bootstrap().cached, true);

  const catalogs = insertCatalogs(context);
  const created = HrSheetStore.insert(HrSchema.TABLES.EMPLOYEES, {
    employee_code: 'A001',
    full_name: 'Employee One',
    department_id: catalogs.department.department_id,
    position_id: catalogs.position.position_id,
    working_condition_id: catalogs.condition.working_condition_id
  });
  assert.equal(created.row_version, 0);
  assert.equal(created.employment_status, 'DRAFT');

  const updated = HrSheetStore.update(
    HrSchema.TABLES.EMPLOYEES,
    created.employee_id,
    { full_name: 'Employee Updated' },
    0
  );
  assert.equal(updated.row_version, 1);
  assert.equal(updated.full_name, 'Employee Updated');
  assert.throws(
    () => HrSheetStore.update(
      HrSchema.TABLES.EMPLOYEES,
      created.employee_id,
      { full_name: 'Stale Update' },
      0
    ),
    (error) => error.code === 'ROW_VERSION_CONFLICT'
  );
  assert.throws(
    () => HrSheetStore.insert(HrSchema.TABLES.EMPLOYEES, {
      employee_code: 'a001',
      full_name: 'Duplicate'
    }),
    (error) => error.code === 'DUPLICATE_RECORD'
  );
  assert.throws(
    () => HrSheetStore.insert(HrSchema.TABLES.EMPLOYEES, {
      employee_code: 'A002',
      full_name: 'Bad FK',
      department_id: 'missing'
    }),
    (error) => error.code === 'FOREIGN_KEY_NOT_FOUND'
  );

  const bulk = [];
  for (let index = 2; index <= 205; index += 1) {
    bulk.push({
      employee_code: `A${String(index).padStart(3, '0')}`,
      full_name: `Employee ${index}`
    });
  }
  HrSheetStore.insertMany(HrSchema.TABLES.EMPLOYEES, bulk);
  assert.equal(HrSheetStore.list(HrSchema.TABLES.EMPLOYEES).length, 205);
  assert.equal(
    HrSheetStore.list(HrSchema.TABLES.EMPLOYEES, { offset: 10, limit: 20 }).length,
    20
  );
});

test('idempotency serializes work and supports domain-shaped replay', () => {
  const { context } = loadFoundation();
  const { HrSheetStore } = context;
  HrSheetStore.bootstrap();
  let calls = 0;
  const first = HrSheetStore.withIdempotency(
    'TEST_CREATE',
    'stable-key',
    ({ operationId }) => {
      calls += 1;
      return { employee: { employee_id: 'entity-1' }, operationId };
    }
  );
  assert.equal(first.employee.employee_id, 'entity-1');

  const replay = HrSheetStore.withIdempotency(
    'TEST_CREATE',
    'stable-key',
    () => {
      calls += 1;
      return { id: 'should-not-run' };
    },
    {
      replayResolver(resultRef, operation) {
        return { id: resultRef, operationId: operation.operation_id, replayed: true };
      }
    }
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(replay)),
    { id: 'entity-1', operationId: first.operationId, replayed: true }
  );
});

test('audit stores hashes and redacts sensitive metadata instead of raw payloads', () => {
  const { context } = loadFoundation();
  const { HrAuditService, HrSchema, HrSheetStore } = context;
  HrSheetStore.bootstrap();
  HrAuditService.change({
    action: 'EMPLOYEE_UPDATED',
    entityType: 'EMPLOYEE',
    entityId: 'employee-1',
    before: { citizen_id: '012345678901', full_name: 'Before' },
    after: { citizen_id: '012345678901', full_name: 'After' },
    metadata: {
      citizen_id: '012345678901',
      notification: 'send to private@example.com'
    }
  });

  const rows = HrSheetStore.list(HrSchema.TABLES.AUDIT_LOGS);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].before_hash.length, 64);
  assert.equal(rows[0].after_hash.length, 64);
  assert.equal(rows[0].sanitized_metadata_json.citizen_id, '[REDACTED]');
  assert.equal(rows[0].sanitized_metadata_json.notification.includes('private@example.com'), false);
  assert.deepEqual(rows[0].changed_fields_json, ['full_name']);
});

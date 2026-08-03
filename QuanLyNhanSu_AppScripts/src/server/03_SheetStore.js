/**
 * Typed Google Sheets repository for the operational HR MVP.
 *
 * All reads/writes use a schema-derived header map and batched range calls.
 * Public mutations acquire ScriptLock and use optimistic row_version checks.
 */
var HrSheetStore = (function () {
  'use strict';

  var HEADER_ROW = 1;
  var lockDepth_ = 0;
  var bootstrapped_ = false;
  var readCache_ = {};

  function invalidate_(tableName) {
    if (tableName) {
      delete readCache_[String(tableName).toUpperCase()];
    } else {
      readCache_ = {};
    }
  }

  function withLock(work, timeoutMs) {
    HrCore.assert(typeof work === 'function', 'LOCK_WORK_REQUIRED', 'Lock work is required.');

    if (lockDepth_ > 0) {
      lockDepth_ += 1;
      try {
        return work();
      } finally {
        lockDepth_ -= 1;
      }
    }

    HrCore.assert(
      typeof LockService !== 'undefined' && LockService.getScriptLock,
      'LOCK_RUNTIME_UNAVAILABLE',
      'Script lock is not available.'
    );

    var timeout = timeoutMs === undefined
      ? HrConfig.getNumber(HrConfig.KEYS.LOCK_TIMEOUT_MS, 5000, { min: 1, max: 30000 })
      : HrCore.parseInteger(timeoutMs, 'timeoutMs', { min: 1, max: 30000 });
    var lock = LockService.getScriptLock();
    var acquired = false;
    try {
      acquired = lock.tryLock(timeout);
      HrCore.assert(acquired, 'LOCK_TIMEOUT', 'The HR data store is busy. Please retry.');
      lockDepth_ = 1;
      // A previous read in this execution may predate another execution that
      // acquired the lock first. Mutations must always re-read under our lock.
      invalidate_();
      return work();
    } finally {
      lockDepth_ = 0;
      if (acquired) lock.releaseLock();
    }
  }

  function spreadsheet_() {
    return HrConfig.openSpreadsheet();
  }

  function normalizeHeader_(value) {
    return HrCore.normalizeString(value);
  }

  function assertHeaders_(sheet, schema) {
    var expected = HrSchema.headers(schema.name);
    var lastColumn = sheet.getLastColumn();
    HrCore.assert(
      lastColumn === expected.length,
      'SHEET_HEADER_MISMATCH',
      schema.name + ' has an unexpected number of columns.'
    );

    var actual = sheet.getRange(HEADER_ROW, 1, 1, expected.length).getValues()[0]
      .map(normalizeHeader_);
    expected.forEach(function (header, index) {
      HrCore.assert(
        actual[index] === header,
        'SHEET_HEADER_MISMATCH',
        schema.name + ' has an invalid header at column ' + (index + 1) + '.'
      );
    });
    return expected;
  }

  function ensureHeaders_(sheet, schema) {
    var expected = HrSchema.headers(schema.name);
    var lastColumn = sheet.getLastColumn();
    if (lastColumn === expected.length) return assertHeaders_(sheet, schema);

    var actual = lastColumn > 0
      ? sheet.getRange(HEADER_ROW, 1, 1, lastColumn).getValues()[0]
        .map(normalizeHeader_)
      : [];
    var upgrade = null;
    (schema.headerUpgrades || []).some(function (candidate) {
      if (candidate.fromHeaders.length !== actual.length) return false;
      var matches = candidate.fromHeaders.every(function (header, index) {
        return normalizeHeader_(header) === actual[index];
      });
      if (matches) upgrade = candidate;
      return matches;
    });

    HrCore.assert(
      upgrade,
      'SHEET_HEADER_MISMATCH',
      schema.name + ' does not match an allowed header upgrade signature.'
    );
    HrCore.assert(
      upgrade.appendHeaders.length > 0,
      'SCHEMA_HEADER_UPGRADE_INVALID',
      schema.name + ' header upgrade does not append any columns.'
    );
    // The upgraded headers must be a valid prefix of the expected schema so
    // that chained upgrades (e.g. V1 → V2) eventually reach the full shape.
    var upgradedHeaders = upgrade.fromHeaders.concat(upgrade.appendHeaders)
      .map(normalizeHeader_);
    HrCore.assert(
      upgradedHeaders.length <= expected.length &&
        upgradedHeaders.every(function (header, index) {
          return header === expected[index];
        }),
      'SCHEMA_HEADER_UPGRADE_INVALID',
      schema.name + ' has an invalid header upgrade definition.'
    );
    sheet.getRange(
      HEADER_ROW,
      lastColumn + 1,
      1,
      upgrade.appendHeaders.length
    ).setValues([upgrade.appendHeaders]);
    // Recurse to apply any subsequent upgrades (e.g. V1 → V2 → assertHeaders).
    return ensureHeaders_(sheet, schema);
  }

  function sheet_(tableName) {
    var schema = HrSchema.get(tableName);
    var sheet = spreadsheet_().getSheetByName(schema.name);
    HrCore.assert(
      sheet,
      'SHEET_NOT_BOOTSTRAPPED',
      schema.name + ' has not been bootstrapped.'
    );
    assertHeaders_(sheet, schema);
    return { sheet: sheet, schema: schema };
  }

  function bootstrap() {
    if (bootstrapped_) {
      return {
        cached: true,
        created: [],
        verified: HrSchema.names()
      };
    }
    var result = withLock(function () {
      invalidate_();
      var config = HrConfig.validate();
      var spreadsheet = spreadsheet_();
      var created = [];
      var verified = [];

      HrSchema.names().forEach(function (tableName) {
        var schema = HrSchema.get(tableName);
        var sheet = spreadsheet.getSheetByName(tableName);
        if (!sheet) {
          sheet = spreadsheet.insertSheet(tableName);
          var headers = HrSchema.headers(tableName);
          sheet.getRange(HEADER_ROW, 1, 1, headers.length).setValues([headers]);
          sheet.setFrozenRows(1);
          created.push(tableName);
        } else {
          ensureHeaders_(sheet, schema);
          verified.push(tableName);
        }
      });

      return {
        cached: false,
        environment: config.environment,
        spreadsheetSource: config.spreadsheetSource,
        created: created,
        verified: verified
      };
    });
    bootstrapped_ = true;
    return result;
  }

  function fromCell_(definition, value) {
    if (value === '' || value === null || value === undefined) return null;
    if (definition.type === 'JSON') {
      var parsed = HrCore.safeJsonParse(value, undefined);
      HrCore.assert(
        parsed !== undefined,
        'SHEET_CELL_INVALID',
        definition.name + ' contains invalid JSON.'
      );
      return parsed;
    }
    if (definition.type === 'INTEGER' || definition.type === 'DECIMAL') {
      var number = Number(value);
      HrCore.assert(
        isFinite(number),
        'SHEET_CELL_INVALID',
        definition.name + ' contains a non-numeric value.'
      );
      return number;
    }
    if (definition.type === 'BOOL') return value === true || String(value).toLowerCase() === 'true';
    if (definition.type === 'DATE') {
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    }
    if (definition.type === 'DATETIME') {
      var date = value instanceof Date ? value : new Date(value);
      HrCore.assert(
        !isNaN(date.getTime()),
        'SHEET_CELL_INVALID',
        definition.name + ' contains an invalid date-time.'
      );
      return date.toISOString();
    }
    var text = String(value);
    // Apps Script stores a leading apostrophe as a literal-text escape. Decode
    // only the formula guard added by toCell_; all other apostrophes are data.
    return text.indexOf("'=") === 0 ? text.slice(1) : text;
  }

  function toCell_(definition, value) {
    if (value === null || value === undefined) return '';
    var cellValue = value;
    if (definition.type === 'JSON' && typeof value !== 'string') {
      cellValue = HrCore.canonicalJson(value);
    }
    // Range.setValues treats strings beginning with "=" as formulas. Canonical
    // HR tables contain data only, so force such text to remain literal.
    if (typeof cellValue === 'string' && cellValue.charAt(0) === '=') {
      return "'" + cellValue;
    }
    return cellValue;
  }

  function rowToRecord_(schema, row, physicalRow) {
    var record = {};
    schema.columns.forEach(function (definition, index) {
      record[definition.name] = fromCell_(definition, row[index]);
    });
    Object.defineProperty(record, '__rowNumber', {
      value: physicalRow,
      enumerable: false,
      configurable: false
    });
    return record;
  }

  function recordToRow_(schema, record) {
    return schema.columns.map(function (definition) {
      return toCell_(definition, record[definition.name]);
    });
  }

  function readAll_(tableName) {
    var cacheKey = String(tableName).toUpperCase();
    if (readCache_[cacheKey]) return readCache_[cacheKey];

    var target = sheet_(tableName);
    var lastRow = target.sheet.getLastRow();
    if (lastRow <= HEADER_ROW) {
      readCache_[cacheKey] = {
        sheet: target.sheet,
        schema: target.schema,
        records: []
      };
      return readCache_[cacheKey];
    }

    var values = target.sheet.getRange(
      HEADER_ROW + 1,
      1,
      lastRow - HEADER_ROW,
      target.schema.columns.length
    ).getValues();
    var records = [];
    values.forEach(function (row, index) {
      var record = rowToRecord_(target.schema, row, HEADER_ROW + 1 + index);
      if (!HrCore.isBlank(record[target.schema.primaryKey])) records.push(record);
    });
    readCache_[cacheKey] = {
      sheet: target.sheet,
      schema: target.schema,
      records: records
    };
    return readCache_[cacheKey];
  }

  function valuesEqual_(left, right, caseInsensitive) {
    if (left === null || left === undefined || left === '') {
      return right === null || right === undefined || right === '';
    }
    if (caseInsensitive && typeof left === 'string' && typeof right === 'string') {
      return left.trim().toLowerCase() === right.trim().toLowerCase();
    }
    return HrCore.canonicalJson(left) === HrCore.canonicalJson(right);
  }

  function matchesFilter_(record, filter) {
    if (!filter) return true;
    if (typeof filter === 'function') return filter(HrCore.clone(record)) === true;
    HrCore.requireObject(filter, 'filter');
    return Object.keys(filter).every(function (field) {
      var expected = filter[field];
      var actual = record[field];
      if (Array.isArray(expected)) {
        return expected.some(function (candidate) {
          return valuesEqual_(actual, candidate, false);
        });
      }
      return valuesEqual_(actual, expected, false);
    });
  }

  function list(tableName, options) {
    var settings = options || {};
    var result = readAll_(tableName);
    var records = result.records.filter(function (record) {
      return matchesFilter_(record, settings.filter);
    });

    if (settings.sortBy) {
      HrSchema.column(result.schema.name, settings.sortBy);
      var direction = String(settings.sortDirection || 'ASC').toUpperCase();
      HrCore.assert(
        direction === 'ASC' || direction === 'DESC',
        'SORT_DIRECTION_INVALID',
        'sortDirection must be ASC or DESC.'
      );
      records.sort(function (left, right) {
        var a = left[settings.sortBy];
        var b = right[settings.sortBy];
        if (a === b) return 0;
        if (a === null || a === undefined) return direction === 'ASC' ? 1 : -1;
        if (b === null || b === undefined) return direction === 'ASC' ? -1 : 1;
        var compared = typeof a === 'string'
          ? a.localeCompare(String(b))
          : (a < b ? -1 : 1);
        return direction === 'ASC' ? compared : -compared;
      });
    }

    var offset = settings.offset === undefined
      ? 0
      : HrCore.parseInteger(settings.offset, 'offset', { min: 0 });
    if (settings.limit === undefined) {
      return records.slice(offset).map(HrCore.clone);
    }
    var maxPageSize = HrConfig.getNumber(
      HrConfig.KEYS.MAX_PAGE_SIZE,
      200,
      { min: 1, max: 2000 }
    );
    var limit = HrCore.parseInteger(
      settings.limit,
      'limit',
      { min: 1, max: maxPageSize }
    );
    return records.slice(offset, offset + limit).map(HrCore.clone);
  }

  function findOne(tableName, filter) {
    var result = readAll_(tableName);
    for (var index = 0; index < result.records.length; index += 1) {
      if (matchesFilter_(result.records[index], filter)) {
        return HrCore.clone(result.records[index]);
      }
    }
    return null;
  }

  function get(tableName, id) {
    var schema = HrSchema.get(tableName);
    var key = HrCore.requireString(id, schema.primaryKey, 200);
    var filter = {};
    filter[schema.primaryKey] = key;
    return findOne(schema.name, filter);
  }

  function normalizeConstraintValue_(value, caseInsensitive) {
    if (caseInsensitive && typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  }

  function assertUnique_(schema, record, existingRecords, excludedId) {
    schema.unique.forEach(function (constraint) {
      var values = constraint.fields.map(function (field) {
        return record[field];
      });
      if (values.some(HrCore.isBlank)) return;

      var duplicate = existingRecords.some(function (candidate) {
        if (excludedId && candidate[schema.primaryKey] === excludedId) return false;
        return constraint.fields.every(function (field, index) {
          return valuesEqual_(
            normalizeConstraintValue_(candidate[field], constraint.caseInsensitive),
            normalizeConstraintValue_(values[index], constraint.caseInsensitive),
            false
          );
        });
      });
      HrCore.assert(
        !duplicate,
        'DUPLICATE_RECORD',
        schema.name + ' violates a unique constraint.'
      );
    });
  }

  function referenceCache_(cache, tableName) {
    if (!cache[tableName]) cache[tableName] = readAll_(tableName).records;
    return cache[tableName];
  }

  function assertReferences_(schema, record, cache) {
    schema.columns.forEach(function (definition) {
      if (!definition.reference || HrCore.isBlank(record[definition.name])) return;
      var candidates = referenceCache_(cache, definition.reference.table);
      var found = candidates.some(function (candidate) {
        return candidate[definition.reference.field] === record[definition.name];
      });
      HrCore.assert(
        found,
        'FOREIGN_KEY_NOT_FOUND',
        definition.name + ' references a missing record.'
      );
    });
  }

  function context_(options) {
    return options && options.context ? options.context : HrCore.context();
  }

  function prepareInsert_(schema, input, context, timestamp) {
    var candidate = HrCore.clone(input) || {};
    if (!schema.appendOnly) {
      candidate.created_at = candidate.created_at || timestamp;
      candidate.created_by = candidate.created_by || context.actor.id;
      candidate.updated_at = candidate.updated_at || timestamp;
      candidate.updated_by = candidate.updated_by || context.actor.id;
      if (candidate.row_version === undefined || candidate.row_version === null) {
        candidate.row_version = 0;
      }
      candidate.record_status = candidate.record_status || 'ACTIVE';
    }
    return HrSchema.prepare(schema.name, candidate, 'insert');
  }

  function insertManyUnlocked_(tableName, records, options) {
    HrCore.assert(Array.isArray(records) && records.length > 0, 'RECORDS_REQUIRED', 'records are required.');
    var target = readAll_(tableName);
    var context = context_(options);
    var timestamp = HrCore.nowIso();
    var prepared = [];
    var referenceCache = {};

    records.forEach(function (record) {
      var candidate = prepareInsert_(target.schema, record, context, timestamp);
      assertUnique_(target.schema, candidate, target.records.concat(prepared), null);
      assertReferences_(target.schema, candidate, referenceCache);
      prepared.push(candidate);
    });

    var rows = prepared.map(function (record) {
      return recordToRow_(target.schema, record);
    });
    target.sheet.getRange(
      target.sheet.getLastRow() + 1,
      1,
      rows.length,
      target.schema.columns.length
    ).setValues(rows);
    invalidate_(target.schema.name);
    return prepared.map(HrCore.clone);
  }

  function insertMany(tableName, records, options) {
    return withLock(function () {
      return insertManyUnlocked_(tableName, records, options);
    });
  }

  function insert(tableName, record, options) {
    return insertMany(tableName, [record], options)[0];
  }

  function updateUnlocked_(tableName, id, patch, expectedRowVersion, options) {
    var target = readAll_(tableName);
    HrCore.assert(!target.schema.appendOnly, 'APPEND_ONLY', target.schema.name + ' is append-only.');

    var key = HrCore.requireString(id, target.schema.primaryKey, 200);
    var expected = HrCore.parseInteger(
      expectedRowVersion,
      'expectedRowVersion',
      { min: 0 }
    );
    var current = null;
    for (var index = 0; index < target.records.length; index += 1) {
      if (target.records[index][target.schema.primaryKey] === key) {
        current = target.records[index];
        break;
      }
    }
    HrCore.assert(current, 'RECORD_NOT_FOUND', target.schema.name + ' record was not found.');
    HrCore.assert(
      current.row_version === expected,
      'ROW_VERSION_CONFLICT',
      'The record changed after it was loaded.'
    );

    var input = HrCore.requireObject(patch, 'patch');
    [
      target.schema.primaryKey,
      'created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'
    ].forEach(function (reserved) {
      HrCore.assert(
        !Object.prototype.hasOwnProperty.call(input, reserved),
        'SYSTEM_FIELD_IMMUTABLE',
        reserved + ' is managed by the server.'
      );
    });

    var preparedPatch = HrSchema.prepare(target.schema.name, input, 'update');
    var merged = {};
    target.schema.columns.forEach(function (definition) {
      merged[definition.name] = current[definition.name];
    });
    Object.keys(preparedPatch).forEach(function (field) {
      merged[field] = preparedPatch[field];
    });
    var context = context_(options);
    merged.updated_at = HrCore.nowIso();
    merged.updated_by = context.actor.id;
    merged.row_version = current.row_version + 1;
    var prepared = HrSchema.prepare(target.schema.name, merged, 'replace');

    assertUnique_(target.schema, prepared, target.records, key);
    assertReferences_(target.schema, prepared, {});
    target.sheet.getRange(
      current.__rowNumber,
      1,
      1,
      target.schema.columns.length
    ).setValues([recordToRow_(target.schema, prepared)]);
    invalidate_(target.schema.name);
    return HrCore.clone(prepared);
  }

  function update(tableName, id, patch, expectedRowVersion, options) {
    var expected = expectedRowVersion;
    var settings = options;
    if (expectedRowVersion && typeof expectedRowVersion === 'object') {
      settings = expectedRowVersion;
      expected = expectedRowVersion.expectedRowVersion;
    }
    return withLock(function () {
      return updateUnlocked_(tableName, id, patch, expected, settings);
    });
  }

  function inferResultRef_(result, depth) {
    if (result === null || result === undefined) return null;
    if (typeof result === 'string' || typeof result === 'number') return String(result);
    if (typeof result !== 'object') return null;
    if ((depth || 0) > 3) return null;
    var candidateKeys = [
      'id', 'employee_id', 'movement_id', 'candidate_id',
      'generated_document_id', 'operation_id', 'department_id',
      'position_id', 'working_condition_id', 'job_template_id'
    ];
    for (var index = 0; index < candidateKeys.length; index += 1) {
      if (!HrCore.isBlank(result[candidateKeys[index]])) {
        return String(result[candidateKeys[index]]);
      }
    }
    var wrapperKeys = [
      'employee', 'movement', 'candidate', 'document',
      'jobTemplate', 'job_template', 'catalog', 'record', 'item', 'data'
    ];
    for (var wrapperIndex = 0; wrapperIndex < wrapperKeys.length; wrapperIndex += 1) {
      if (result[wrapperKeys[wrapperIndex]]) {
        var nested = inferResultRef_(
          result[wrapperKeys[wrapperIndex]],
          (depth || 0) + 1
        );
        if (nested) return nested;
      }
    }
    return null;
  }

  function claimOperation_(action, idempotencyKey, options) {
    var context = context_(options);
    var normalizedAction = HrCore.requireString(action, 'action', 100).toUpperCase();
    var normalizedKey = HrCore.requireString(
      idempotencyKey,
      'idempotencyKey',
      160
    ).toUpperCase();
    var existing = findOne(HrSchema.TABLES.OPERATION_JOURNAL, {
      action: normalizedAction,
      idempotency_key: normalizedKey
    });

    if (existing && existing.technical_status === 'APPLIED') {
      return { replayed: true, operation: existing, context: context };
    }
    if (existing && existing.technical_status === 'PENDING') {
      throw HrCore.error(
        'OPERATION_IN_PROGRESS',
        'An operation with this idempotency key is already in progress.'
      );
    }

    var now = HrCore.nowIso();
    if (existing) {
      var retried = updateUnlocked_(
        HrSchema.TABLES.OPERATION_JOURNAL,
        existing.operation_id,
        {
          technical_status: 'PENDING',
          checkpoint: null,
          result_ref: null,
          sanitized_error_code: null,
          sanitized_error_message: null,
          attempt_count: existing.attempt_count + 1,
          started_at: now,
          completed_at: null
        },
        existing.row_version,
        { context: context }
      );
      return { replayed: false, operation: retried, context: context };
    }

    var created = insertManyUnlocked_(
      HrSchema.TABLES.OPERATION_JOURNAL,
      [{
        idempotency_key: normalizedKey,
        action: normalizedAction,
        aggregate_type: options && options.aggregateType
          ? String(options.aggregateType).toUpperCase()
          : null,
        aggregate_id: options && options.aggregateId ? String(options.aggregateId) : null,
        request_id: context.requestId,
        technical_status: 'PENDING',
        checkpoint: null,
        result_ref: null,
        sanitized_error_code: null,
        sanitized_error_message: null,
        attempt_count: 1,
        started_at: now,
        completed_at: null
      }],
      { context: context }
    )[0];
    return { replayed: false, operation: created, context: context };
  }

  function replayResult_(claim, settings) {
    if (typeof settings.replayResolver === 'function') {
      return settings.replayResolver(
        claim.operation.result_ref,
        HrCore.clone(claim.operation)
      );
    }
    return {
      replayed: true,
      operationId: claim.operation.operation_id,
      resultRef: claim.operation.result_ref
    };
  }

  function completeOperation_(claim, result, settings) {
    var resultRef = typeof settings.resultRef === 'function'
      ? settings.resultRef(result)
      : (settings.resultRef || inferResultRef_(result));
    resultRef = resultRef || claim.operation.aggregate_id || null;
    var current = get(
      HrSchema.TABLES.OPERATION_JOURNAL,
      claim.operation.operation_id
    );
    updateUnlocked_(
      HrSchema.TABLES.OPERATION_JOURNAL,
      current.operation_id,
      {
        technical_status: 'APPLIED',
        checkpoint: settings.successCheckpoint || 'APPLIED',
        result_ref: resultRef,
        sanitized_error_code: null,
        sanitized_error_message: null,
        completed_at: HrCore.nowIso()
      },
      current.row_version,
      { context: claim.context }
    );
  }

  function failOperation_(claim, sourceError, settings) {
    var safe = HrCore.sanitizeError(sourceError);
    try {
      var current = get(
        HrSchema.TABLES.OPERATION_JOURNAL,
        claim.operation.operation_id
      );
      if (current) {
        updateUnlocked_(
          HrSchema.TABLES.OPERATION_JOURNAL,
          current.operation_id,
          {
            technical_status: 'FAILED',
            checkpoint: settings.failureCheckpoint || 'FAILED',
            sanitized_error_code: safe.code,
            sanitized_error_message: safe.message,
            completed_at: HrCore.nowIso()
          },
          current.row_version,
          { context: claim.context }
        );
      }
    } catch (journalError) {
      // Do not replace the original sanitized business failure with a journal failure.
    }
    throw HrCore.error(safe.code, safe.message);
  }

  function runClaimedWork_(claim, work, settings) {
    if (claim.replayed) return replayResult_(claim, settings);
    try {
      var result = work({
        operationId: claim.operation.operation_id,
        context: claim.context,
        replayed: false
      });
      completeOperation_(claim, result, settings);
      return result;
    } catch (sourceError) {
      return failOperation_(claim, sourceError, settings);
    }
  }

  function withIdempotency(action, idempotencyKey, work, options) {
    HrCore.assert(
      typeof work === 'function',
      'IDEMPOTENCY_WORK_REQUIRED',
      'Idempotent work is required.'
    );
    var settings = options || {};

    if (settings.holdLock !== false) {
      return withLock(function () {
        var lockedClaim = claimOperation_(action, idempotencyKey, settings);
        return runClaimedWork_(lockedClaim, work, settings);
      });
    }

    var claim = withLock(function () {
      return claimOperation_(action, idempotencyKey, settings);
    });
    if (claim.replayed) return replayResult_(claim, settings);

    try {
      var result = work({
        operationId: claim.operation.operation_id,
        context: claim.context,
        replayed: false
      });
      withLock(function () {
        completeOperation_(claim, result, settings);
      });
      return result;
    } catch (sourceError) {
      return withLock(function () {
        return failOperation_(claim, sourceError, settings);
      });
    }
  }

  function checkpoint(operationId, value, expectedRowVersion, options) {
    return update(
      HrSchema.TABLES.OPERATION_JOURNAL,
      operationId,
      { checkpoint: HrCore.requireString(value, 'checkpoint', 100).toUpperCase() },
      expectedRowVersion,
      options
    );
  }

  return Object.freeze({
    bootstrap: bootstrap,
    list: list,
    get: get,
    findOne: findOne,
    insert: insert,
    insertMany: insertMany,
    update: update,
    withLock: withLock,
    withIdempotency: withIdempotency,
    checkpoint: checkpoint
  });
})();

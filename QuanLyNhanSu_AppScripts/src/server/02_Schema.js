/**
 * Canonical operational MVP schema. Sheet headers are derived only from this
 * registry; repositories must never depend on magic column indexes.
 */
var HrSchema = (function () {
  'use strict';

  var TABLES = Object.freeze({
    EMPLOYEES: 'EMPLOYEES',
    DEPARTMENTS: 'DEPARTMENTS',
    POSITIONS: 'POSITIONS',
    WORKING_CONDITIONS: 'WORKING_CONDITIONS',
    WORKFORCE_MOVEMENTS: 'WORKFORCE_MOVEMENTS',
    PROBATION_JOB_TEMPLATES: 'PROBATION_JOB_TEMPLATES',
    PROBATION_CANDIDATES: 'PROBATION_CANDIDATES',
    GENERATED_DOCUMENTS: 'GENERATED_DOCUMENTS',
    AUDIT_LOGS: 'AUDIT_LOGS',
    OPERATION_JOURNAL: 'OPERATION_JOURNAL'
  });

  var RECORD_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

  function column(name, type, options) {
    var settings = options || {};
    return Object.freeze({
      name: name,
      type: type,
      required: settings.required === true,
      immutable: settings.immutable === true,
      defaultValue: settings.defaultValue,
      enumValues: settings.enumValues ? Object.freeze(settings.enumValues.slice()) : null,
      reference: settings.reference || null,
      maxLength: settings.maxLength || null
    });
  }

  function reference(tableName, fieldName) {
    return Object.freeze({ table: tableName, field: fieldName });
  }

  function primaryKey(name) {
    return column(name, 'UUID', {
      required: true,
      immutable: true,
      defaultValue: function () { return HrCore.uuid(); }
    });
  }

  function commonMutableColumns() {
    return [
      column('created_at', 'DATETIME', { required: true, immutable: true }),
      column('created_by', 'TEXT', { required: true, immutable: true, maxLength: 120 }),
      column('updated_at', 'DATETIME', { required: true }),
      column('updated_by', 'TEXT', { required: true, maxLength: 120 }),
      column('row_version', 'INTEGER', { required: true, defaultValue: 0 }),
      column('record_status', 'ENUM', {
        required: true,
        defaultValue: 'ACTIVE',
        enumValues: RECORD_STATUSES
      }),
      column('legacy_system', 'TEXT', { maxLength: 80 }),
      column('legacy_id', 'TEXT', { maxLength: 160 }),
      column('source_hash', 'SHA256')
    ];
  }

  function mutableTable(name, primaryKeyName, businessColumns, options) {
    var settings = options || {};
    return table(
      name,
      primaryKeyName,
      [primaryKey(primaryKeyName)].concat(businessColumns, commonMutableColumns()),
      {
        appendOnly: false,
        unique: settings.unique || []
      }
    );
  }

  function table(name, primaryKeyName, columns, options) {
    var settings = options || {};
    var columnMap = {};
    columns.forEach(function (definition) {
      if (columnMap[definition.name]) {
        throw new Error('Duplicate schema column ' + definition.name + ' in ' + name + '.');
      }
      columnMap[definition.name] = definition;
    });
    return Object.freeze({
      name: name,
      primaryKey: primaryKeyName,
      appendOnly: settings.appendOnly === true,
      columns: Object.freeze(columns.slice()),
      columnMap: Object.freeze(columnMap),
      unique: Object.freeze((settings.unique || []).map(function (constraint) {
        return Object.freeze({
          fields: Object.freeze(constraint.fields.slice()),
          caseInsensitive: constraint.caseInsensitive === true
        });
      }))
    });
  }

  var SCHEMAS = {};

  SCHEMAS[TABLES.EMPLOYEES] = mutableTable(TABLES.EMPLOYEES, 'employee_id', [
    column('employee_code', 'CODE', { required: true, maxLength: 40 }),
    column('full_name', 'TEXT', { required: true, maxLength: 240 }),
    column('gender', 'ENUM', {
      required: true,
      defaultValue: 'UNKNOWN',
      enumValues: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']
    }),
    column('date_of_birth', 'DATE'),
    column('ethnicity', 'TEXT', { maxLength: 120 }),
    column('religion', 'TEXT', { maxLength: 120 }),
    column('birth_place_original', 'TEXT', { maxLength: 500 }),
    column('birth_place_current', 'TEXT', { maxLength: 500 }),
    column('legacy_identity_number', 'TEXT', { maxLength: 80 }),
    column('citizen_id', 'TEXT', { maxLength: 80 }),
    column('citizen_id_issued_date', 'DATE'),
    column('citizen_id_issued_place', 'TEXT', { maxLength: 500 }),
    column('identity_verification_status', 'ENUM', {
      required: true,
      defaultValue: 'UNVERIFIED',
      enumValues: ['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']
    }),
    column('social_insurance_number', 'TEXT', { maxLength: 80 }),
    column('health_insurance_number', 'TEXT', { maxLength: 80 }),
    column('insurance_status', 'ENUM', {
      required: true,
      defaultValue: 'UNKNOWN',
      enumValues: ['UNKNOWN', 'ACTIVE', 'INACTIVE', 'NEEDS_REVIEW']
    }),
    column('permanent_address', 'TEXT', { maxLength: 1000 }),
    column('current_address', 'TEXT', { maxLength: 1000 }),
    column('phone', 'TEXT', { maxLength: 40 }),
    column('work_email', 'TEXT', { maxLength: 320 }),
    column('personal_email', 'TEXT', { maxLength: 320 }),
    column('emergency_contact_name', 'TEXT', { maxLength: 240 }),
    column('emergency_contact_phone', 'TEXT', { maxLength: 40 }),
    column('emergency_contact_relation', 'TEXT', { maxLength: 120 }),
    column('department_id', 'UUID', {
      reference: reference(TABLES.DEPARTMENTS, 'department_id')
    }),
    column('position_id', 'UUID', {
      reference: reference(TABLES.POSITIONS, 'position_id')
    }),
    column('working_condition_id', 'UUID', {
      reference: reference(TABLES.WORKING_CONDITIONS, 'working_condition_id')
    }),
    column('hire_date', 'DATE'),
    column('official_date', 'DATE'),
    column('termination_date', 'DATE'),
    column('contract_type_code', 'CODE', { maxLength: 80 }),
    column('base_salary', 'DECIMAL'),
    column('allowance', 'DECIMAL'),
    column('job_description', 'TEXT', { maxLength: 10000 }),
    column('employment_status', 'ENUM', {
      required: true,
      defaultValue: 'DRAFT',
      enumValues: ['DRAFT', 'ACTIVE', 'INACTIVE']
    }),
    column('status_effective_date', 'DATE')
  ], {
    unique: [{ fields: ['employee_code'], caseInsensitive: true }]
  });

  SCHEMAS[TABLES.DEPARTMENTS] = mutableTable(TABLES.DEPARTMENTS, 'department_id', [
    column('code', 'CODE', { required: true, maxLength: 80 }),
    column('name', 'TEXT', { required: true, maxLength: 240 }),
    column('parent_department_id', 'UUID', {
      reference: reference(TABLES.DEPARTMENTS, 'department_id')
    }),
    column('description', 'TEXT', { maxLength: 2000 }),
    column('sort_order', 'INTEGER', { required: true, defaultValue: 0 }),
    column('catalog_status', 'ENUM', {
      required: true,
      defaultValue: 'ACTIVE',
      enumValues: ['ACTIVE', 'INACTIVE']
    })
  ], {
    unique: [
      { fields: ['code'], caseInsensitive: true },
      { fields: ['name'], caseInsensitive: true }
    ]
  });

  SCHEMAS[TABLES.POSITIONS] = mutableTable(TABLES.POSITIONS, 'position_id', [
    column('code', 'CODE', { required: true, maxLength: 80 }),
    column('name', 'TEXT', { required: true, maxLength: 240 }),
    column('description', 'TEXT', { maxLength: 2000 }),
    column('sort_order', 'INTEGER', { required: true, defaultValue: 0 }),
    column('catalog_status', 'ENUM', {
      required: true,
      defaultValue: 'ACTIVE',
      enumValues: ['ACTIVE', 'INACTIVE']
    })
  ], {
    unique: [
      { fields: ['code'], caseInsensitive: true },
      { fields: ['name'], caseInsensitive: true }
    ]
  });

  SCHEMAS[TABLES.WORKING_CONDITIONS] = mutableTable(
    TABLES.WORKING_CONDITIONS,
    'working_condition_id',
    [
      column('code', 'CODE', { required: true, maxLength: 80 }),
      column('name', 'TEXT', { required: true, maxLength: 240 }),
      column('description', 'TEXT', { maxLength: 2000 }),
      column('sort_order', 'INTEGER', { required: true, defaultValue: 0 }),
      column('catalog_status', 'ENUM', {
        required: true,
        defaultValue: 'ACTIVE',
        enumValues: ['ACTIVE', 'INACTIVE']
      })
    ],
    {
      unique: [
        { fields: ['code'], caseInsensitive: true },
        { fields: ['name'], caseInsensitive: true }
      ]
    }
  );

  SCHEMAS[TABLES.WORKFORCE_MOVEMENTS] = mutableTable(
    TABLES.WORKFORCE_MOVEMENTS,
    'movement_id',
    [
      column('employee_id', 'UUID', {
        required: true,
        reference: reference(TABLES.EMPLOYEES, 'employee_id')
      }),
      column('movement_type', 'ENUM', {
        required: true,
        enumValues: [
          'INITIAL_LOAD', 'INCREASE', 'DECREASE', 'TRANSFER',
          'POSITION_CHANGE', 'WORKING_CONDITION_CHANGE', 'ADJUSTMENT', 'REHIRE'
        ]
      }),
      column('movement_status', 'ENUM', {
        required: true,
        defaultValue: 'DRAFT',
        enumValues: ['DRAFT', 'CONFIRMED', 'CANCELLED']
      }),
      column('effective_date', 'DATE', { required: true }),
      column('from_department_id', 'UUID', {
        reference: reference(TABLES.DEPARTMENTS, 'department_id')
      }),
      column('to_department_id', 'UUID', {
        reference: reference(TABLES.DEPARTMENTS, 'department_id')
      }),
      column('from_position_id', 'UUID', {
        reference: reference(TABLES.POSITIONS, 'position_id')
      }),
      column('to_position_id', 'UUID', {
        reference: reference(TABLES.POSITIONS, 'position_id')
      }),
      column('from_working_condition_id', 'UUID', {
        reference: reference(TABLES.WORKING_CONDITIONS, 'working_condition_id')
      }),
      column('to_working_condition_id', 'UUID', {
        reference: reference(TABLES.WORKING_CONDITIONS, 'working_condition_id')
      }),
      column('from_employee_status', 'ENUM', {
        enumValues: ['DRAFT', 'ACTIVE', 'INACTIVE']
      }),
      column('to_employee_status', 'ENUM', {
        enumValues: ['DRAFT', 'ACTIVE', 'INACTIVE']
      }),
      column('reason', 'TEXT', { maxLength: 2000 }),
      column('decision_number', 'TEXT', { maxLength: 120 }),
      column('decision_date', 'DATE'),
      column('source_kind', 'ENUM', {
        required: true,
        defaultValue: 'MANUAL',
        enumValues: ['BASELINE_IMPORT', 'EXCEL_IMPORT', 'MANUAL', 'SYSTEM']
      }),
      column('correction_of_movement_id', 'UUID', {
        reference: reference(TABLES.WORKFORCE_MOVEMENTS, 'movement_id')
      }),
      column('idempotency_key', 'TEXT', { required: true, maxLength: 160 }),
      column('confirmed_at', 'DATETIME'),
      column('confirmed_by', 'TEXT', { maxLength: 120 }),
      column('cancelled_at', 'DATETIME'),
      column('cancelled_by', 'TEXT', { maxLength: 120 })
    ],
    {
      unique: [{ fields: ['idempotency_key'] }]
    }
  );

  SCHEMAS[TABLES.PROBATION_JOB_TEMPLATES] = mutableTable(
    TABLES.PROBATION_JOB_TEMPLATES,
    'job_template_id',
    [
      column('code', 'CODE', { required: true, maxLength: 80 }),
      column('name', 'TEXT', { required: true, maxLength: 240 }),
      column('version', 'INTEGER', { required: true, defaultValue: 1 }),
      column('department_id', 'UUID', {
        reference: reference(TABLES.DEPARTMENTS, 'department_id')
      }),
      column('position_id', 'UUID', {
        reference: reference(TABLES.POSITIONS, 'position_id')
      }),
      column('working_condition_id', 'UUID', {
        reference: reference(TABLES.WORKING_CONDITIONS, 'working_condition_id')
      }),
      column('probation_contract_type', 'TEXT', { maxLength: 160 }),
      column('job_description', 'TEXT', { maxLength: 10000 }),
      column('base_salary_amount', 'DECIMAL'),
      column('currency', 'CODE', { required: true, defaultValue: 'VND', maxLength: 12 }),
      column('salary_note_suffix', 'TEXT', { maxLength: 500 }),
      column('department_rule_note', 'TEXT', { maxLength: 4000 }),
      column('sort_order', 'INTEGER', { required: true, defaultValue: 0 }),
      column('template_status', 'ENUM', {
        required: true,
        defaultValue: 'DRAFT',
        enumValues: ['DRAFT', 'ACTIVE', 'INACTIVE']
      }),
      column('effective_from', 'DATE'),
      column('effective_until', 'DATE'),
      column('replaces_version', 'INTEGER'),
      column('content_sha256', 'SHA256')
    ],
    {
      unique: [{ fields: ['code', 'version'], caseInsensitive: true }]
    }
  );

  SCHEMAS[TABLES.PROBATION_CANDIDATES] = mutableTable(
    TABLES.PROBATION_CANDIDATES,
    'candidate_id',
    [
      column('candidate_code', 'CODE', { required: true, maxLength: 80 }),
      column('full_name', 'TEXT', { required: true, maxLength: 240 }),
      column('gender', 'ENUM', {
        required: true,
        defaultValue: 'UNKNOWN',
        enumValues: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']
      }),
      column('date_of_birth', 'DATE'),
      column('birth_place', 'TEXT', { maxLength: 500 }),
      column('nationality', 'TEXT', { maxLength: 120 }),
      column('citizen_id', 'TEXT', { maxLength: 80 }),
      column('citizen_id_issued_date', 'DATE'),
      column('citizen_id_issued_place', 'TEXT', { maxLength: 500 }),
      column('permanent_address', 'TEXT', { maxLength: 1000 }),
      column('phone', 'TEXT', { maxLength: 40 }),
      column('email', 'TEXT', { maxLength: 320 }),
      column('candidate_title', 'TEXT', { maxLength: 120 }),
      column('department_id', 'UUID', {
        reference: reference(TABLES.DEPARTMENTS, 'department_id')
      }),
      column('position_id', 'UUID', {
        reference: reference(TABLES.POSITIONS, 'position_id')
      }),
      column('working_condition_id', 'UUID', {
        reference: reference(TABLES.WORKING_CONDITIONS, 'working_condition_id')
      }),
      column('job_template_id', 'UUID', {
        reference: reference(TABLES.PROBATION_JOB_TEMPLATES, 'job_template_id')
      }),
      column('probation_contract_type', 'TEXT', { maxLength: 160 }),
      column('job_description', 'TEXT', { maxLength: 10000 }),
      column('base_salary_amount', 'DECIMAL'),
      column('currency', 'CODE', { required: true, defaultValue: 'VND', maxLength: 12 }),
      column('salary_note_suffix', 'TEXT', { maxLength: 500 }),
      column('department_rule_note', 'TEXT', { maxLength: 4000 }),
      column('probation_start_date', 'DATE'),
      column('probation_end_date', 'DATE'),
      column('candidate_status', 'ENUM', {
        required: true,
        defaultValue: 'DRAFT',
        enumValues: [
          'DRAFT', 'CONTRACT_CREATED', 'IN_PROBATION', 'PASSED',
          'FAILED', 'CONVERTED', 'CANCELLED'
        ]
      }),
      column('status_reason', 'TEXT', { maxLength: 2000 }),
      column('converted_employee_id', 'UUID', {
        reference: reference(TABLES.EMPLOYEES, 'employee_id')
      }),
      column('converted_at', 'DATETIME'),
      column('converted_by', 'TEXT', { maxLength: 120 })
    ],
    {
      unique: [{ fields: ['candidate_code'], caseInsensitive: true }]
    }
  );

  SCHEMAS[TABLES.GENERATED_DOCUMENTS] = mutableTable(
    TABLES.GENERATED_DOCUMENTS,
    'generated_document_id',
    [
      column('operation_id', 'UUID', {
        required: true,
        reference: reference(TABLES.OPERATION_JOURNAL, 'operation_id')
      }),
      column('document_type', 'ENUM', {
        required: true,
        enumValues: ['PROBATION_CONTRACT', 'EMPLOYMENT_CONTRACT', 'HR_DECISION', 'OTHER']
      }),
      column('document_template_id', 'TEXT', { required: true, maxLength: 160 }),
      column('document_template_version', 'CODE', { required: true, maxLength: 40 }),
      column('document_template_hash', 'SHA256', { required: true }),
      column('candidate_id', 'UUID', {
        reference: reference(TABLES.PROBATION_CANDIDATES, 'candidate_id')
      }),
      column('employee_id', 'UUID', {
        reference: reference(TABLES.EMPLOYEES, 'employee_id')
      }),
      column('contract_id', 'UUID'),
      column('job_template_id', 'UUID', {
        reference: reference(TABLES.PROBATION_JOB_TEMPLATES, 'job_template_id')
      }),
      column('job_template_version', 'INTEGER'),
      column('job_template_hash', 'SHA256'),
      column('contract_no', 'TEXT', { maxLength: 80 }),
      column('contract_year', 'INTEGER'),
      column('placeholder_schema_version', 'CODE', { required: true, maxLength: 40 }),
      column('secure_snapshot_ref', 'TEXT', { required: true, maxLength: 500 }),
      column('render_payload_hash', 'SHA256', { required: true }),
      column('private_folder_id', 'TEXT', { required: true, maxLength: 160 }),
      column('google_doc_file_id', 'TEXT', { maxLength: 160 }),
      column('google_doc_sha256', 'SHA256'),
      column('docx_file_id', 'TEXT', { maxLength: 160 }),
      column('docx_sha256', 'SHA256'),
      column('pdf_file_id', 'TEXT', { maxLength: 160 }),
      column('pdf_sha256', 'SHA256'),
      column('generation_status', 'ENUM', {
        required: true,
        defaultValue: 'PROCESSING',
        enumValues: [
          'PROCESSING', 'PREVIEW', 'GENERATED', 'SUPERSEDED', 'VOIDED', 'FAILED'
        ]
      }),
      column('generated_at', 'DATETIME'),
      column('generated_by', 'TEXT', { maxLength: 120 }),
      column('supersedes_document_id', 'UUID', {
        reference: reference(TABLES.GENERATED_DOCUMENTS, 'generated_document_id')
      }),
      column('superseded_by_id', 'UUID', {
        reference: reference(TABLES.GENERATED_DOCUMENTS, 'generated_document_id')
      }),
      column('void_reason', 'TEXT', { maxLength: 2000 }),
      column('error_code', 'CODE', { maxLength: 80 })
    ],
    {
      unique: [
        { fields: ['operation_id'] },
        { fields: ['document_type', 'contract_no', 'contract_year'], caseInsensitive: true }
      ]
    }
  );

  SCHEMAS[TABLES.AUDIT_LOGS] = table(
    TABLES.AUDIT_LOGS,
    'audit_id',
    [
      primaryKey('audit_id'),
      column('request_id', 'UUID', { required: true }),
      column('actor_id', 'TEXT', { required: true, maxLength: 120 }),
      column('actor_display_name', 'TEXT', { required: true, maxLength: 240 }),
      column('actor_type', 'ENUM', {
        required: true,
        enumValues: ['INTERNAL', 'SYSTEM', 'MIGRATION']
      }),
      column('action', 'CODE', { required: true, maxLength: 100 }),
      column('entity_type', 'CODE', { required: true, maxLength: 100 }),
      column('entity_id', 'TEXT', { maxLength: 160 }),
      column('changed_fields_json', 'JSON', { required: true }),
      column('before_hash', 'SHA256'),
      column('after_hash', 'SHA256'),
      column('sanitized_metadata_json', 'JSON', { required: true }),
      column('result', 'ENUM', {
        required: true,
        enumValues: ['SUCCESS', 'DENIED', 'FAILED']
      }),
      column('error_code', 'CODE', { maxLength: 80 }),
      column('occurred_at', 'DATETIME', { required: true }),
      column('created_at', 'DATETIME', { required: true, immutable: true }),
      column('created_by', 'TEXT', { required: true, immutable: true, maxLength: 120 }),
      column('source_hash', 'SHA256')
    ],
    { appendOnly: true, unique: [] }
  );

  SCHEMAS[TABLES.OPERATION_JOURNAL] = mutableTable(
    TABLES.OPERATION_JOURNAL,
    'operation_id',
    [
      column('idempotency_key', 'TEXT', { required: true, maxLength: 160 }),
      column('action', 'CODE', { required: true, maxLength: 100 }),
      column('aggregate_type', 'CODE', { maxLength: 100 }),
      column('aggregate_id', 'TEXT', { maxLength: 160 }),
      column('request_id', 'UUID', { required: true }),
      column('technical_status', 'ENUM', {
        required: true,
        defaultValue: 'PENDING',
        enumValues: ['PENDING', 'APPLIED', 'FAILED']
      }),
      column('checkpoint', 'CODE', { maxLength: 100 }),
      column('result_ref', 'TEXT', { maxLength: 500 }),
      column('sanitized_error_code', 'CODE', { maxLength: 80 }),
      column('sanitized_error_message', 'TEXT', { maxLength: 300 }),
      column('attempt_count', 'INTEGER', { required: true, defaultValue: 1 }),
      column('started_at', 'DATETIME', { required: true }),
      column('completed_at', 'DATETIME')
    ],
    {
      unique: [{ fields: ['action', 'idempotency_key'], caseInsensitive: true }]
    }
  );

  Object.freeze(SCHEMAS);

  function get(tableName) {
    var name = HrCore.requireString(tableName, 'tableName', 120).toUpperCase();
    var schema = SCHEMAS[name];
    HrCore.assert(schema, 'SCHEMA_UNKNOWN', 'Unknown HR table: ' + name + '.');
    return schema;
  }

  function names() {
    return Object.keys(SCHEMAS);
  }

  function headers(tableName) {
    return get(tableName).columns.map(function (definition) {
      return definition.name;
    });
  }

  function primaryKeyName(tableName) {
    return get(tableName).primaryKey;
  }

  function columnDefinition(tableName, columnName) {
    var definition = get(tableName).columnMap[columnName];
    HrCore.assert(
      definition,
      'SCHEMA_COLUMN_UNKNOWN',
      'Unknown column ' + columnName + ' in ' + String(tableName).toUpperCase() + '.'
    );
    return definition;
  }

  function defaultValue_(definition) {
    return typeof definition.defaultValue === 'function'
      ? definition.defaultValue()
      : definition.defaultValue;
  }

  function coerce_(definition, value) {
    if (HrCore.isBlank(value)) {
      HrCore.assert(
        !definition.required,
        'SCHEMA_REQUIRED',
        definition.name + ' is required.'
      );
      return null;
    }

    var result;
    switch (definition.type) {
      case 'TEXT':
      case 'UUID':
        result = HrCore.normalizeString(value);
        break;
      case 'CODE':
        result = HrCore.normalizeString(value).toUpperCase();
        break;
      case 'SHA256':
        result = HrCore.normalizeString(value).toLowerCase();
        HrCore.assert(
          /^[a-f0-9]{64}$/.test(result),
          'SCHEMA_SHA256_INVALID',
          definition.name + ' must be a SHA-256 hex value.'
        );
        break;
      case 'DATE':
        if (value instanceof Date) {
          result = value.toISOString().slice(0, 10);
        } else {
          result = HrCore.normalizeString(value);
        }
        HrCore.assert(
          /^\d{4}-\d{2}-\d{2}$/.test(result) &&
            !isNaN(new Date(result + 'T00:00:00.000Z').getTime()),
          'SCHEMA_DATE_INVALID',
          definition.name + ' must use yyyy-MM-dd.'
        );
        break;
      case 'DATETIME':
        var date = value instanceof Date ? value : new Date(value);
        HrCore.assert(
          !isNaN(date.getTime()),
          'SCHEMA_DATETIME_INVALID',
          definition.name + ' must be an ISO date-time.'
        );
        result = date.toISOString();
        break;
      case 'INTEGER':
        result = HrCore.parseInteger(value, definition.name);
        break;
      case 'DECIMAL':
        result = Number(value);
        HrCore.assert(
          isFinite(result),
          'SCHEMA_DECIMAL_INVALID',
          definition.name + ' must be numeric.'
        );
        break;
      case 'BOOL':
        if (typeof value === 'boolean') {
          result = value;
        } else {
          var bool = HrCore.normalizeString(value).toLowerCase();
          HrCore.assert(
            bool === 'true' || bool === 'false',
            'SCHEMA_BOOLEAN_INVALID',
            definition.name + ' must be boolean.'
          );
          result = bool === 'true';
        }
        break;
      case 'JSON':
        if (typeof value === 'string') {
          var parsed = HrCore.safeJsonParse(value, undefined);
          HrCore.assert(
            parsed !== undefined,
            'SCHEMA_JSON_INVALID',
            definition.name + ' must be valid JSON.'
          );
          result = HrCore.canonicalJson(parsed);
        } else {
          result = HrCore.canonicalJson(value);
        }
        break;
      case 'ENUM':
        result = HrCore.normalizeString(value).toUpperCase();
        HrCore.assert(
          definition.enumValues.indexOf(result) >= 0,
          'SCHEMA_ENUM_INVALID',
          definition.name + ' has an unsupported value.'
        );
        break;
      default:
        throw HrCore.error(
          'SCHEMA_TYPE_UNKNOWN',
          'Unknown type for ' + definition.name + '.'
        );
    }

    if (definition.maxLength && typeof result === 'string') {
      HrCore.assert(
        result.length <= definition.maxLength,
        'SCHEMA_LENGTH_INVALID',
        definition.name + ' is too long.'
      );
    }
    return result;
  }

  function prepare(tableName, record, mode) {
    var schema = get(tableName);
    var input = HrCore.requireObject(record, 'record');
    var operation = mode || 'insert';
    HrCore.assert(
      ['insert', 'update', 'replace'].indexOf(operation) >= 0,
      'SCHEMA_MODE_INVALID',
      'Unsupported schema validation mode.'
    );

    Object.keys(input).forEach(function (key) {
      HrCore.assert(
        schema.columnMap[key],
        'SCHEMA_COLUMN_UNKNOWN',
        'Unknown column ' + key + ' in ' + schema.name + '.'
      );
      if (operation === 'update') {
        HrCore.assert(
          !schema.columnMap[key].immutable,
          'SCHEMA_IMMUTABLE',
          key + ' cannot be updated.'
        );
      }
    });

    var prepared = {};
    schema.columns.forEach(function (definition) {
      var hasInput = Object.prototype.hasOwnProperty.call(input, definition.name);
      var value = hasInput ? input[definition.name] : undefined;

      if (!hasInput && operation === 'insert' && definition.defaultValue !== undefined) {
        value = defaultValue_(definition);
        hasInput = true;
      }

      if (hasInput) {
        prepared[definition.name] = coerce_(definition, value);
      } else if (operation === 'insert' || operation === 'replace') {
        HrCore.assert(
          !definition.required,
          'SCHEMA_REQUIRED',
          definition.name + ' is required.'
        );
        prepared[definition.name] = null;
      }
    });
    return prepared;
  }

  return Object.freeze({
    TABLES: TABLES,
    get: get,
    names: names,
    headers: headers,
    primaryKey: primaryKeyName,
    column: columnDefinition,
    prepare: prepare
  });
})();

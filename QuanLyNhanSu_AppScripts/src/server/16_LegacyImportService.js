/**
 * One-time, production-safe migration from the legacy Vietnamese workforce
 * sheet into the canonical HR tables.
 *
 * The source tab is read-only. A preview fingerprint must be confirmed before
 * any canonical row is written. Re-running a confirmation is safe because
 * employee_code is treated as the stable legacy identity.
 */
var HrLegacyImportService = (function () {
  'use strict';

  var CONTRACT_VERSION_ = 'LEGACY_WORKFORCE_V1';
  var HEADER_SCAN_ROWS_ = 25;
  var MAX_SOURCE_ROWS_ = 5000;
  var MAX_SOURCE_COLUMNS_ = 80;
  var MAX_ISSUES_RETURNED_ = 200;
  var LEGACY_SYSTEM_ = 'LEGACY_WORKFORCE_SHEET';

  var HEADER_ALIASES_ = Object.freeze({
    'STT': 'display_order',
    'STT PHONG BAN': 'department_display_order',
    'MA SO': 'employee_code',
    'MA NHAN SU': 'employee_code',
    'SO SO BHXH': 'social_insurance_number',
    'SO BHXH': 'social_insurance_number',
    'HO VA TEN': 'full_name',
    'HO TEN': 'full_name',
    'BHYT': 'health_insurance_number',
    'SO THE BHYT': 'health_insurance_number',
    'LUONG': 'base_salary',
    'LUONG CHINH': 'base_salary',
    'PHU CAP': 'allowance',
    'TONG THU NHAP': 'source_total_income',
    'GIOI TINH': 'gender',
    'DAN TOC': 'ethnicity',
    'TON GIAO': 'religion',
    'CHUC VU': 'position_name',
    'DON VI CONG TAC': 'department_name',
    'PHONG BAN': 'department_name',
    'NGAY SINH': 'date_of_birth',
    'NGAY LAM': 'hire_date',
    'NGAY VAO LAM': 'hire_date',
    'HDLD': 'contract_type_code',
    'LOAI HDLD': 'contract_type_code',
    'SO HDLD': 'contract_number',
    'SO HOP DONG': 'contract_number',
    'NAM CONG TAC': 'source_years_of_service',
    'CMND': 'legacy_identity_number',
    'CCCD': 'citizen_id',
    'NGAY CAP': 'citizen_id_issued_date',
    'MOI TRUONG LAM VIEC': 'working_condition_name',
    'NOI CAP': 'citizen_id_issued_place',
    'NOI SINH': 'birth_place_original',
    'NOI SINH SAU SAT NHAP': 'birth_place_current',
    'DIA CHI THUONG TRU': 'permanent_address',
    'DIA CHI HIEN NAY': 'current_address',
    'SO DIEN THOAI': 'phone',
    'DIEN THOAI': 'phone',
    'NGAY THAM GIA BHXH': 'social_insurance_start_date',
    'NGAY THAM GIA': 'social_insurance_start_date',
    'NOI DANG KY KCB BAN DAU': 'medical_registration_place',
    'NOI DANG KY KCB': 'medical_registration_place',
    'BENH VIEN DANG KY KCB': 'medical_registration_place',
    'TRINH DO': 'education_level',
    'CHUYEN NGANH': 'major',
    'CONG VIEC PHAI LAM': 'job_description',
    'TUOI': 'source_age',
    'NGAY NGHI PHEP': 'leave_days'
  });

  var PERSISTED_SOURCE_FIELDS_ = Object.freeze([
    'display_order',
    'department_display_order',
    'employee_code',
    'social_insurance_number',
    'full_name',
    'health_insurance_number',
    'base_salary',
    'allowance',
    'gender',
    'ethnicity',
    'religion',
    'date_of_birth',
    'hire_date',
    'contract_type_code',
    'contract_number',
    'legacy_identity_number',
    'citizen_id',
    'citizen_id_issued_date',
    'citizen_id_issued_place',
    'birth_place_original',
    'birth_place_current',
    'permanent_address',
    'current_address',
    'phone',
    'education_level',
    'major',
    'job_description',
    'leave_days',
    'social_insurance_start_date',
    'medical_registration_place'
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

  function trim_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function headerKey_(value) {
    var text = trim_(value).replace(/[Đđ]/g, 'D');
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function valueKey_(value) {
    return headerKey_(value);
  }

  function baselinePeriodFromSheetName_(value) {
    var match = /^T\s*(\d{1,2})\s*[-_/]\s*(\d{2}|\d{4})$/i.exec(trim_(value));
    if (!match) return null;
    var month = Number(match[1]);
    var year = Number(match[2]);
    if (match[2].length === 2) year += 2000;
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
    return year + '-' + String(month).padStart(2, '0');
  }

  function employeeCodeKey_(value) {
    return trim_(value).toUpperCase().replace(/\s+/g, '');
  }

  function employeeCode_(cell, rowNumber, issues) {
    var value = employeeCodeKey_(identifier_(cell));
    if (value && !/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(value)) {
      issue_(issues, rowNumber, 'employee_code', 'ERROR',
        'LEGACY_EMPLOYEE_CODE_INVALID',
        'Mã số nhân sự chỉ được chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    }
    return value || null;
  }

  function contractTypeCode_(cell) {
    var raw = nullableText_(cell);
    if (!raw) return null;
    var value = valueKey_(raw);
    if (value === 'INDEFINITE' ||
        value.indexOf('KHONG XAC DINH') >= 0 ||
        value.indexOf('KHONG THOI HAN') >= 0 ||
        value.indexOf('VO THOI HAN') >= 0) {
      return 'INDEFINITE';
    }
    if (value === 'PROBATION' || value.indexOf('THU VIEC') >= 0) {
      return 'PROBATION';
    }
    if (value === 'FIXED TERM' ||
        value.indexOf('XAC DINH') >= 0 ||
        value.indexOf('CO THOI HAN') >= 0 ||
        /\b\d+\s*(THANG|NAM)\b/.test(value)) {
      return 'FIXED_TERM';
    }
    return value.replace(/\s+/g, '_').slice(0, 80);
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function all_(tableName) {
    return rows_(HrSheetStore.list(tableName));
  }

  function migrationContext_(options) {
    options = options || {};
    var base = options.context || HrCore.context(options.requestId);
    return {
      actor: {
        id: base.actor.id,
        displayName: base.actor.displayName,
        type: 'MIGRATION'
      },
      requestId: base.requestId,
      occurredAt: base.occurredAt || HrCore.nowIso()
    };
  }

  function canonicalSheetNames_() {
    var result = {};
    HrSchema.names().forEach(function (name) {
      result[String(name).toUpperCase()] = true;
    });
    return result;
  }

  function displayValues_(range) {
    if (range && typeof range.getDisplayValues === 'function') {
      return range.getDisplayValues();
    }
    return range.getValues().map(function (row) {
      return row.map(function (value) {
        if (value === null || value === undefined) return '';
        return value instanceof Date ? value.toISOString() : String(value);
      });
    });
  }

  function mappedColumns_(headerRow) {
    var fieldToColumn = {};
    var recognized = 0;
    headerRow.forEach(function (header, index) {
      var field = HEADER_ALIASES_[headerKey_(header)];
      if (!field || fieldToColumn[field] !== undefined) return;
      fieldToColumn[field] = index;
      recognized += 1;
    });
    return {
      fieldToColumn: fieldToColumn,
      recognized: recognized,
      hasRequired: fieldToColumn.employee_code !== undefined &&
        fieldToColumn.full_name !== undefined
    };
  }

  function detectSource_(requestedSheetName) {
    var spreadsheet = HrConfig.openSpreadsheet();
    var canonicalNames = canonicalSheetNames_();
    var requested = trim_(requestedSheetName);
    var sheets = requested
      ? [spreadsheet.getSheetByName(requested)]
      : spreadsheet.getSheets();
    var candidates = [];

    assert_(!requested || sheets[0], 'LEGACY_IMPORT_SOURCE_NOT_FOUND',
      'Không tìm thấy tab dữ liệu nguồn đã chọn.');

    sheets.forEach(function (sheet, sheetIndex) {
      if (!sheet) return;
      var sheetName = sheet.getName();
      if (canonicalNames[String(sheetName).toUpperCase()]) return;
      var lastRow = Number(sheet.getLastRow() || 0);
      var lastColumn = Number(sheet.getLastColumn() || 0);
      if (lastRow < 1 || lastColumn < 1) return;

      var scanRows = Math.min(lastRow, HEADER_SCAN_ROWS_);
      var scanColumns = Math.min(lastColumn, MAX_SOURCE_COLUMNS_);
      var values = displayValues_(sheet.getRange(1, 1, scanRows, scanColumns));
      values.forEach(function (row, rowIndex) {
        var mapping = mappedColumns_(row);
        if (!mapping.hasRequired) return;
        candidates.push({
          spreadsheet: spreadsheet,
          sheet: sheet,
          sheetName: sheetName,
          headerRow: rowIndex + 1,
          mapping: mapping.fieldToColumn,
          recognized: mapping.recognized,
          lastRow: lastRow,
          lastColumn: lastColumn,
          sheetIndex: sheetIndex
        });
      });
    });

    assert_(candidates.length > 0, 'LEGACY_IMPORT_HEADER_NOT_FOUND',
      'Không tìm thấy tab nguồn có tiêu đề MÃ SỐ và HỌ VÀ TÊN.');
    candidates.sort(function (left, right) {
      if (left.recognized !== right.recognized) return right.recognized - left.recognized;
      if (left.headerRow !== right.headerRow) return left.headerRow - right.headerRow;
      return left.sheetIndex - right.sheetIndex;
    });

    var source = candidates[0];
    assert_(source.lastRow <= MAX_SOURCE_ROWS_, 'LEGACY_IMPORT_SOURCE_TOO_LARGE',
      'Tab nguồn vượt quá giới hạn ' + MAX_SOURCE_ROWS_ + ' dòng.',
      { row_count: source.lastRow, max_rows: MAX_SOURCE_ROWS_ });
    assert_(source.lastColumn <= MAX_SOURCE_COLUMNS_, 'LEGACY_IMPORT_SOURCE_TOO_WIDE',
      'Tab nguồn vượt quá giới hạn ' + MAX_SOURCE_COLUMNS_ + ' cột.',
      { column_count: source.lastColumn, max_columns: MAX_SOURCE_COLUMNS_ });
    return source;
  }

  function readSource_(requestedSheetName) {
    var source = detectSource_(requestedSheetName);
    var rowCount = source.lastRow - source.headerRow + 1;
    var range = source.sheet.getRange(
      source.headerRow,
      1,
      rowCount,
      source.lastColumn
    );
    var raw = range.getValues();
    var display = displayValues_(range);
    var header = display[0] || [];
    var mapping = mappedColumns_(header).fieldToColumn;
    var relevantColumns = Object.keys(mapping).map(function (field) {
      return { field: field, column: mapping[field] };
    }).sort(function (left, right) {
      return left.column - right.column;
    });
    var sourceRows = [];

    for (var index = 1; index < display.length; index += 1) {
      var displayRow = display[index] || [];
      var rawRow = raw[index] || [];
      var hasValue = relevantColumns.some(function (entry) {
        return trim_(displayRow[entry.column]) !== '';
      });
      if (!hasValue) continue;
      sourceRows.push({
        rowNumber: source.headerRow + index,
        raw: rawRow,
        display: displayRow
      });
    }
    assert_(sourceRows.length > 0, 'LEGACY_IMPORT_SOURCE_EMPTY',
      'Tab nguồn không có dòng nhân sự để nhập.');

    var fingerprintRows = sourceRows.map(function (row) {
      return {
        row_number: row.rowNumber,
        values: relevantColumns.map(function (entry) {
          return [entry.field, trim_(row.display[entry.column])];
        })
      };
    });
    var fingerprint = HrCore.sha256({
      contract_version: CONTRACT_VERSION_,
      sheet_name: source.sheetName,
      header_row: source.headerRow,
      columns: relevantColumns.map(function (entry) { return entry.field; }),
      rows: fingerprintRows
    });

    return {
      sheet: source.sheet,
      sheetName: source.sheetName,
      headerRow: source.headerRow,
      lastRow: source.lastRow,
      lastColumn: source.lastColumn,
      mapping: mapping,
      relevantColumns: relevantColumns,
      rows: sourceRows,
      fingerprint: fingerprint
    };
  }

  function cell_(sourceRow, mapping, field) {
    var column = mapping[field];
    if (column === undefined) return { raw: null, display: '' };
    return {
      raw: sourceRow.raw[column],
      display: sourceRow.display[column]
    };
  }

  function issue_(issues, rowNumber, field, severity, code, message) {
    issues.push({
      row_number: rowNumber,
      field: field,
      severity: severity,
      code: code,
      message: message
    });
  }

  function nullableText_(cell) {
    var value = trim_(cell.display);
    if (!value || value.toUpperCase() === '#N/A') return null;
    return value;
  }

  function identifier_(cell) {
    var value = nullableText_(cell);
    if (value && value.charAt(0) === "'") value = value.slice(1);
    return value;
  }

  function number_(cell, rowNumber, field, issues) {
    if (cell.raw === null || cell.raw === undefined || cell.raw === '') return null;
    if (typeof cell.raw === 'number' && isFinite(cell.raw)) return cell.raw;
    var text = trim_(cell.display).replace(/\s+/g, '').replace(/[^\d,.\-]/g, '');
    if (!text) return null;
    if (/^-?\d{1,3}([.,]\d{3})+$/.test(text)) {
      text = text.replace(/[.,]/g, '');
    } else if (text.indexOf(',') >= 0 && text.indexOf('.') < 0) {
      text = text.replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
    var result = Number(text);
    if (!isFinite(result) || result < 0) {
      issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_NUMBER_INVALID',
        'Giá trị số không hợp lệ hoặc nhỏ hơn 0.');
      return null;
    }
    return result;
  }

  function integer_(cell, rowNumber, field, issues) {
    var result = number_(cell, rowNumber, field, issues);
    if (result === null) return null;
    if (Math.floor(result) !== result) {
      issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_INTEGER_INVALID',
        'Giá trị phải là số nguyên.');
      return null;
    }
    return result;
  }

  function date_(cell, rowNumber, field, issues, required) {
    if (cell.raw === null || cell.raw === undefined || cell.raw === '') {
      if (required) {
        issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_DATE_REQUIRED',
          'Thiếu ngày bắt buộc trong dữ liệu nguồn.');
      }
      return null;
    }
    if (Object.prototype.toString.call(cell.raw) === '[object Date]') {
      if (isNaN(cell.raw.getTime())) {
        issue_(issues, rowNumber, field, required ? 'ERROR' : 'WARNING', 'LEGACY_DATE_INVALID',
          'Ngày nguồn không hợp lệ; trường này được để trống.');
        return null;
      }
      if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
        return Utilities.formatDate(
          cell.raw,
          HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
          'yyyy-MM-dd'
        );
      }
      return cell.raw.toISOString().slice(0, 10);
    }

    var text = trim_(cell.display || cell.raw);
    var match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    var year;
    var month;
    var day;
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
      if (match) {
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
      }
    }
    if (!match) {
      issue_(issues, rowNumber, field, required ? 'ERROR' : 'WARNING', 'LEGACY_DATE_INVALID',
        'Ngày nguồn không hợp lệ; trường này được để trống.');
      return null;
    }
    var parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day) {
      issue_(issues, rowNumber, field, required ? 'ERROR' : 'WARNING', 'LEGACY_DATE_INVALID',
        'Ngày nguồn không hợp lệ; trường này được để trống.');
      return null;
    }
    return [
      String(year).padStart(4, '0'),
      String(month).padStart(2, '0'),
      String(day).padStart(2, '0')
    ].join('-');
  }

  function gender_(cell, rowNumber, issues) {
    var value = valueKey_(cell.display);
    if (!value) return 'UNKNOWN';
    if (value === 'NAM' || value === 'MALE') return 'MALE';
    if (value === 'NU' || value === 'FEMALE') return 'FEMALE';
    issue_(issues, rowNumber, 'gender', 'WARNING', 'LEGACY_GENDER_UNKNOWN',
      'Giới tính nguồn chưa nhận diện được; hệ thống lưu UNKNOWN.');
    return 'UNKNOWN';
  }

  function enforceLength_(record, field, rowNumber, issues) {
    var value = record[field];
    if (value === null || value === undefined || typeof value !== 'string') return;
    var definition = HrSchema.get(HrSchema.TABLES.EMPLOYEES).columnMap[field];
    if (definition && definition.maxLength && value.length > definition.maxLength) {
      issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_VALUE_TOO_LONG',
        'Giá trị vượt quá độ dài cho phép; dữ liệu không bị cắt.');
    }
  }

  function enforceFormulaSafe_(value, field, rowNumber, issues) {
    if (typeof value !== 'string' || trim_(value).charAt(0) !== '=') return;
    issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_FORMULA_TEXT_BLOCKED',
      'Giá trị văn bản bắt đầu bằng dấu bằng không được phép nhập vào bảng dữ liệu.');
  }

  function enforceCatalogNameLength_(name, tableName, field, rowNumber, issues) {
    if (!name) return;
    var definition = HrSchema.get(tableName).columnMap.name;
    if (definition && definition.maxLength && name.length > definition.maxLength) {
      issue_(issues, rowNumber, field, 'ERROR', 'LEGACY_VALUE_TOO_LONG',
        'Tên danh mục vượt quá độ dài cho phép; dữ liệu không bị cắt.');
    }
  }

  function parseRows_(source) {
    var issues = [];
    var parsed = [];
    var seenCodes = {};

    source.rows.forEach(function (sourceRow) {
      var mapping = source.mapping;
      var employeeCode = employeeCode_(
        cell_(sourceRow, mapping, 'employee_code'),
        sourceRow.rowNumber,
        issues
      );
      var fullName = nullableText_(cell_(sourceRow, mapping, 'full_name'));
      var codeKey = employeeCodeKey_(employeeCode);

      if (!employeeCode) {
        issue_(issues, sourceRow.rowNumber, 'employee_code', 'ERROR',
          'LEGACY_EMPLOYEE_CODE_REQUIRED', 'Thiếu mã số nhân sự.');
      }
      if (!fullName) {
        issue_(issues, sourceRow.rowNumber, 'full_name', 'ERROR',
          'LEGACY_EMPLOYEE_NAME_REQUIRED', 'Thiếu họ và tên.');
      }
      if (codeKey && seenCodes[codeKey]) {
        issue_(issues, sourceRow.rowNumber, 'employee_code', 'ERROR',
          'LEGACY_EMPLOYEE_CODE_DUPLICATE',
          'Mã số nhân sự bị trùng trong tab nguồn.');
      }
      if (codeKey) seenCodes[codeKey] = true;

      var record = {
        display_order: integer_(
          cell_(sourceRow, mapping, 'display_order'),
          sourceRow.rowNumber,
          'display_order',
          issues
        ),
        department_display_order: integer_(
          cell_(sourceRow, mapping, 'department_display_order'),
          sourceRow.rowNumber,
          'department_display_order',
          issues
        ),
        employee_code: employeeCode,
        full_name: fullName,
        gender: gender_(cell_(sourceRow, mapping, 'gender'), sourceRow.rowNumber, issues),
        date_of_birth: date_(
          cell_(sourceRow, mapping, 'date_of_birth'),
          sourceRow.rowNumber,
          'date_of_birth',
          issues,
          true
        ),
        ethnicity: nullableText_(cell_(sourceRow, mapping, 'ethnicity')),
        religion: nullableText_(cell_(sourceRow, mapping, 'religion')),
        birth_place_original: nullableText_(cell_(sourceRow, mapping, 'birth_place_original')),
        birth_place_current: nullableText_(cell_(sourceRow, mapping, 'birth_place_current')),
        legacy_identity_number: identifier_(cell_(sourceRow, mapping, 'legacy_identity_number')),
        citizen_id: identifier_(cell_(sourceRow, mapping, 'citizen_id')),
        citizen_id_issued_date: date_(
          cell_(sourceRow, mapping, 'citizen_id_issued_date'),
          sourceRow.rowNumber,
          'citizen_id_issued_date',
          issues,
          false
        ),
        citizen_id_issued_place: nullableText_(
          cell_(sourceRow, mapping, 'citizen_id_issued_place')
        ),
        identity_verification_status: 'UNVERIFIED',
        social_insurance_number: identifier_(
          cell_(sourceRow, mapping, 'social_insurance_number')
        ),
        health_insurance_number: identifier_(
          cell_(sourceRow, mapping, 'health_insurance_number')
        ),
        insurance_status: 'UNKNOWN',
        permanent_address: nullableText_(cell_(sourceRow, mapping, 'permanent_address')),
        current_address: nullableText_(cell_(sourceRow, mapping, 'current_address')),
        phone: identifier_(cell_(sourceRow, mapping, 'phone')),
        hire_date: date_(
          cell_(sourceRow, mapping, 'hire_date'),
          sourceRow.rowNumber,
          'hire_date',
          issues,
          true
        ),
        contract_type_code: contractTypeCode_(
          cell_(sourceRow, mapping, 'contract_type_code')
        ),
        contract_number: nullableText_(cell_(sourceRow, mapping, 'contract_number')),
        base_salary: number_(
          cell_(sourceRow, mapping, 'base_salary'),
          sourceRow.rowNumber,
          'base_salary',
          issues
        ),
        allowance: number_(
          cell_(sourceRow, mapping, 'allowance'),
          sourceRow.rowNumber,
          'allowance',
          issues
        ),
        education_level: nullableText_(cell_(sourceRow, mapping, 'education_level')),
        major: nullableText_(cell_(sourceRow, mapping, 'major')),
        job_description: nullableText_(cell_(sourceRow, mapping, 'job_description')),
        leave_days: number_(
          cell_(sourceRow, mapping, 'leave_days'),
          sourceRow.rowNumber,
          'leave_days',
          issues
        ),
        social_insurance_start_date: date_(
          cell_(sourceRow, mapping, 'social_insurance_start_date'),
          sourceRow.rowNumber,
          'social_insurance_start_date',
          issues,
          false
        ),
        medical_registration_place: nullableText_(
          cell_(sourceRow, mapping, 'medical_registration_place')
        ),
        employment_status: 'ACTIVE',
        status_effective_date: null
      };
      record.status_effective_date = record.hire_date;
      if (record.base_salary === null) {
        issue_(issues, sourceRow.rowNumber, 'base_salary', 'ERROR',
          'LEGACY_BASE_SALARY_REQUIRED', 'Thiếu lương chính trong dữ liệu nguồn.');
      }

      PERSISTED_SOURCE_FIELDS_.forEach(function (field) {
        enforceFormulaSafe_(record[field], field, sourceRow.rowNumber, issues);
        enforceLength_(record, field, sourceRow.rowNumber, issues);
      });
      var departmentName = nullableText_(cell_(sourceRow, mapping, 'department_name'));
      var positionName = nullableText_(cell_(sourceRow, mapping, 'position_name'));
      var workingConditionName = nullableText_(
        cell_(sourceRow, mapping, 'working_condition_name')
      );
      if (!departmentName) {
        issue_(issues, sourceRow.rowNumber, 'department_name', 'ERROR',
          'LEGACY_DEPARTMENT_REQUIRED', 'Thiếu đơn vị công tác.');
      }
      if (!positionName) {
        issue_(issues, sourceRow.rowNumber, 'position_name', 'ERROR',
          'LEGACY_POSITION_REQUIRED', 'Thiếu chức vụ.');
      }
      enforceFormulaSafe_(
        departmentName,
        'department_name',
        sourceRow.rowNumber,
        issues
      );
      enforceFormulaSafe_(
        positionName,
        'position_name',
        sourceRow.rowNumber,
        issues
      );
      enforceFormulaSafe_(
        workingConditionName,
        'working_condition_name',
        sourceRow.rowNumber,
        issues
      );
      enforceCatalogNameLength_(
        departmentName,
        HrSchema.TABLES.DEPARTMENTS,
        'department_name',
        sourceRow.rowNumber,
        issues
      );
      enforceCatalogNameLength_(
        positionName,
        HrSchema.TABLES.POSITIONS,
        'position_name',
        sourceRow.rowNumber,
        issues
      );
      enforceCatalogNameLength_(
        workingConditionName,
        HrSchema.TABLES.WORKING_CONDITIONS,
        'working_condition_name',
        sourceRow.rowNumber,
        issues
      );
      parsed.push({
        rowNumber: sourceRow.rowNumber,
        employee: record,
        departmentName: departmentName,
        positionName: positionName,
        workingConditionName: workingConditionName
      });
    });
    return { rows: parsed, issues: issues };
  }

  function existingEmployeeCodes_() {
    var result = {};
    all_(HrSchema.TABLES.EMPLOYEES).forEach(function (employee) {
      if (employee.record_status === 'DELETED') return;
      result[employeeCodeKey_(employee.employee_code)] = employee;
    });
    return result;
  }

  function catalogInfo_() {
    return {
      department: {
        table: HrSchema.TABLES.DEPARTMENTS,
        idField: 'department_id',
        prefix: 'PB'
      },
      position: {
        table: HrSchema.TABLES.POSITIONS,
        idField: 'position_id',
        prefix: 'CV'
      },
      workingCondition: {
        table: HrSchema.TABLES.WORKING_CONDITIONS,
        idField: 'working_condition_id',
        prefix: 'MT'
      }
    };
  }

  function catalogExisting_(info) {
    var byName = {};
    var byCode = {};
    var maxSortOrder = 0;
    all_(info.table).forEach(function (row) {
      byName[valueKey_(row.name)] = row;
      byCode[String(row.code || '').toUpperCase()] = row;
      maxSortOrder = Math.max(maxSortOrder, Number(row.sort_order || 0));
    });
    return { byName: byName, byCode: byCode, maxSortOrder: maxSortOrder };
  }

  function uniqueNames_(parsedRows, field) {
    var result = {};
    parsedRows.forEach(function (row) {
      var name = trim_(row[field]);
      if (name) result[valueKey_(name)] = name;
    });
    return result;
  }

  function catalogPreview_(parsedRows, field, info) {
    var existing = catalogExisting_(info);
    var names = uniqueNames_(parsedRows, field);
    var created = 0;
    var reused = 0;
    Object.keys(names).forEach(function (nameKey) {
      if (existing.byName[nameKey]) reused += 1;
      else created += 1;
    });
    return { new_count: created, reused_count: reused, total_distinct: created + reused };
  }

  function confirmationToken_(source) {
    return HrCore.sha256({
      contract_version: CONTRACT_VERSION_,
      source_sheet_name: source.sheetName,
      header_row: source.headerRow,
      source_fingerprint: source.fingerprint
    });
  }

  function countIssues_(issues, severity) {
    return issues.filter(function (issue) { return issue.severity === severity; }).length;
  }

  function analyze_(options) {
    options = options || {};
    var requestedSheet = options.source_sheet_name || options.sourceSheetName;
    var source = readSource_(requestedSheet);
    var parsed = parseRows_(source);
    var existingCodes = existingEmployeeCodes_();
    var existingCount = 0;

    parsed.rows.forEach(function (row) {
      if (existingCodes[employeeCodeKey_(row.employee.employee_code)]) existingCount += 1;
    });
    var infos = catalogInfo_();
    var errors = countIssues_(parsed.issues, 'ERROR');
    var warnings = countIssues_(parsed.issues, 'WARNING');
    var invalidRows = {};
    parsed.issues.forEach(function (issue) {
      if (issue.severity === 'ERROR') invalidRows[issue.row_number] = true;
    });

    return {
      source: source,
      parsed: parsed,
      existingCodes: existingCodes,
      token: confirmationToken_(source),
      summary: {
        source_rows: source.rows.length,
        valid_rows: Math.max(parsed.rows.length - Object.keys(invalidRows).length, 0),
        invalid_rows: Object.keys(invalidRows).length,
        new_employees: Math.max(parsed.rows.length - existingCount, 0),
        existing_employee_codes: existingCount,
        error_count: errors,
        warning_count: warnings,
        catalogs: {
          departments: catalogPreview_(parsed.rows, 'departmentName', infos.department),
          positions: catalogPreview_(parsed.rows, 'positionName', infos.position),
          working_conditions: catalogPreview_(
            parsed.rows,
            'workingConditionName',
            infos.workingCondition
          )
        }
      }
    };
  }

  function sourceDto_(analysis) {
    return {
      sheet_name: analysis.source.sheetName,
      header_row: analysis.source.headerRow,
      scanned_rows: analysis.source.lastRow - analysis.source.headerRow,
      data_rows: analysis.source.rows.length,
      detected_columns: analysis.source.relevantColumns.map(function (entry) {
        return entry.field;
      }),
      fingerprint: analysis.source.fingerprint,
      source_tab_modified: false
    };
  }

  function preview(options) {
    HrSheetStore.bootstrap();
    return HrSheetStore.withLock(function () {
      var analysis = analyze_(options || {});
      var issueCount = analysis.parsed.issues.length;
      return {
        stage: 'PREVIEW',
        ready_to_confirm: analysis.summary.error_count === 0,
        message: analysis.summary.error_count === 0
          ? 'Đã kiểm tra dữ liệu nguồn. Có thể xác nhận nhập dữ liệu.'
          : 'Dữ liệu nguồn còn lỗi; cần xử lý trước khi xác nhận.',
        source: sourceDto_(analysis),
        confirmation: {
          confirmation_token: analysis.token,
          source_sheet_name: analysis.source.sheetName,
          header_row: analysis.source.headerRow,
          source_fingerprint: analysis.source.fingerprint
        },
        summary: analysis.summary,
        issues: analysis.parsed.issues.slice(0, MAX_ISSUES_RETURNED_),
        omitted_issue_count: Math.max(issueCount - MAX_ISSUES_RETURNED_, 0)
      };
    });
  }

  function slug_(value) {
    var result = valueKey_(value).replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
    return result || 'KHAC';
  }

  function uniqueCatalogCode_(info, name, occupiedCodes) {
    var base = (info.prefix + '-' + slug_(name)).slice(0, 70);
    var candidate = base;
    var sequence = 1;
    while (occupiedCodes[candidate]) {
      sequence += 1;
      candidate = (base.slice(0, 70 - String(sequence).length) + '-' + sequence).slice(0, 80);
    }
    occupiedCodes[candidate] = true;
    return candidate;
  }

  function prepareCatalog_(parsedRows, sourceField, info) {
    var existing = catalogExisting_(info);
    var names = uniqueNames_(parsedRows, sourceField);
    var occupiedCodes = {};
    Object.keys(existing.byCode).forEach(function (code) { occupiedCodes[code] = true; });
    var createdRecords = [];
    var byName = {};
    var nextSort = existing.maxSortOrder;

    Object.keys(existing.byName).forEach(function (key) {
      byName[key] = existing.byName[key];
    });
    Object.keys(names).sort().forEach(function (nameKey) {
      var current = byName[nameKey];
      if (current) {
        assert_(current.catalog_status === 'ACTIVE' && current.record_status !== 'DELETED',
          'LEGACY_IMPORT_CATALOG_INACTIVE',
          'Danh mục trùng tên đang ngừng sử dụng; cần kích hoạt trước khi nhập.',
          { catalog_table: info.table });
        return;
      }
      nextSort += 1;
      var name = names[nameKey];
      var record = {};
      record[info.idField] = HrCore.uuid();
      record.code = uniqueCatalogCode_(info, name, occupiedCodes);
      record.name = name;
      record.description = 'Tạo tự động khi nhập dữ liệu nhân sự cũ.';
      record.sort_order = nextSort;
      record.catalog_status = 'ACTIVE';
      record.record_status = 'ACTIVE';
      record.legacy_system = LEGACY_SYSTEM_;
      record.legacy_id = nameKey.length <= 160
        ? nameKey
        : 'NAME_SHA256:' + HrCore.sha256(name);
      record.source_hash = HrCore.sha256({ kind: info.table, name: name });
      createdRecords.push(record);
      byName[nameKey] = record;
    });

    return {
      byName: byName,
      records: createdRecords,
      createdCount: createdRecords.length,
      reusedCount: Object.keys(names).length - createdRecords.length
    };
  }

  function employeeSourceHash_(parsedRow, sourceFingerprint) {
    return HrCore.sha256({
      source_fingerprint: sourceFingerprint,
      source_row: parsedRow.rowNumber,
      employee_code: parsedRow.employee.employee_code,
      fields: parsedRow.employee
    });
  }

  function employeeRecord_(parsedRow, catalogs, sourceFingerprint) {
    var employee = {};
    Object.keys(parsedRow.employee).forEach(function (field) {
      employee[field] = parsedRow.employee[field];
    });
    employee.employee_id = HrCore.uuid();
    employee.department_id = parsedRow.departmentName
      ? catalogs.departments.byName[valueKey_(parsedRow.departmentName)].department_id
      : null;
    employee.position_id = parsedRow.positionName
      ? catalogs.positions.byName[valueKey_(parsedRow.positionName)].position_id
      : null;
    employee.working_condition_id = parsedRow.workingConditionName
      ? catalogs.workingConditions.byName[
        valueKey_(parsedRow.workingConditionName)
      ].working_condition_id
      : null;
    employee.record_status = 'ACTIVE';
    employee.legacy_system = LEGACY_SYSTEM_;
    employee.legacy_id = employee.employee_code;
    employee.source_hash = employeeSourceHash_(parsedRow, sourceFingerprint);
    return employee;
  }

  function assertConfirmation_(analysis, request) {
    var expectedSheet = trim_(request.source_sheet_name || request.sourceSheetName);
    var expectedHeader = Number(request.header_row || request.headerRow);
    var expectedFingerprint = trim_(
      request.source_fingerprint || request.sourceFingerprint
    ).toLowerCase();
    var expectedToken = trim_(
      request.confirmation_token || request.confirmationToken
    ).toLowerCase();

    assert_(expectedSheet && expectedHeader && expectedFingerprint && expectedToken,
      'LEGACY_IMPORT_CONFIRMATION_REQUIRED',
      'Thiếu thông tin xác nhận từ bước xem trước.');
    assert_(analysis.source.sheetName === expectedSheet &&
      analysis.source.headerRow === expectedHeader &&
      analysis.source.fingerprint === expectedFingerprint &&
      analysis.token === expectedToken,
      'LEGACY_IMPORT_SOURCE_CHANGED',
      'Dữ liệu nguồn đã thay đổi sau bước xem trước; hãy xem trước lại.');
    assert_(analysis.summary.error_count === 0,
      'LEGACY_IMPORT_SOURCE_HAS_ERRORS',
      'Dữ liệu nguồn còn lỗi nên chưa thể nhập.',
      { error_count: analysis.summary.error_count });
  }

  function preflight_(tableName, records, context) {
    if (!records.length) return;
    var schema = HrSchema.get(tableName);
    var timestamp = HrCore.nowIso();
    records.forEach(function (record) {
      var candidate = {};
      Object.keys(record).forEach(function (field) { candidate[field] = record[field]; });
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
      HrSchema.prepare(tableName, candidate, 'insert');
    });
  }

  function auditConfirmation_(analysis, result, context) {
    if (typeof HrAuditService === 'undefined' ||
        typeof HrAuditService.record !== 'function') return;
    HrAuditService.record({
      action: 'LEGACY_WORKFORCE_IMPORT_CONFIRMED',
      entityType: 'LEGACY_WORKFORCE_IMPORT',
      entityId: analysis.source.fingerprint,
      changedFields: [
        'departments', 'positions', 'working_conditions', 'employees'
      ],
      afterHash: HrCore.sha256(result.summary),
      metadata: {
        // Persist only the normalized reporting period. A source tab name can
        // contain a person's name or other PII and is intentionally omitted.
        baseline_period: baselinePeriodFromSheetName_(analysis.source.sheetName),
        source_fingerprint: analysis.source.fingerprint,
        source_row_count: analysis.source.rows.length,
        imported_employee_count: result.summary.imported_employees,
        skipped_employee_count: result.summary.skipped_existing_employees,
        applied_source_employee_count: result.summary.applied_source_employees,
        created_department_count: result.summary.created_departments,
        created_position_count: result.summary.created_positions,
        created_working_condition_count: result.summary.created_working_conditions
      },
      context: context
    });
  }

  function hasConfirmationAudit_(sourceFingerprint) {
    if (typeof HrAuditService === 'undefined') return false;
    return all_(HrSchema.TABLES.AUDIT_LOGS).some(function (row) {
      return row.action === 'LEGACY_WORKFORCE_IMPORT_CONFIRMED' &&
        row.entity_type === 'LEGACY_WORKFORCE_IMPORT' &&
        row.entity_id === sourceFingerprint &&
        row.result === 'SUCCESS';
    });
  }

  function confirm(request, options) {
    request = request || {};
    options = options || {};
    HrSheetStore.bootstrap();
    return HrSheetStore.withLock(function () {
      var requestedSheet = request.source_sheet_name || request.sourceSheetName;
      var analysis = analyze_({ source_sheet_name: requestedSheet });
      assertConfirmation_(analysis, request);
      var context = migrationContext_(options);
      var infos = catalogInfo_();
      var catalogs = {
        departments: prepareCatalog_(
          analysis.parsed.rows,
          'departmentName',
          infos.department
        ),
        positions: prepareCatalog_(
          analysis.parsed.rows,
          'positionName',
          infos.position
        ),
        workingConditions: prepareCatalog_(
          analysis.parsed.rows,
          'workingConditionName',
          infos.workingCondition
        )
      };
      var currentCodes = existingEmployeeCodes_();
      var newEmployees = [];
      var skipped = 0;
      var expectedSourceHashes = {};

      analysis.parsed.rows.forEach(function (parsedRow) {
        var key = employeeCodeKey_(parsedRow.employee.employee_code);
        expectedSourceHashes[key] = employeeSourceHash_(
          parsedRow,
          analysis.source.fingerprint
        );
        if (currentCodes[key]) {
          skipped += 1;
          return;
        }
        var employee = employeeRecord_(
          parsedRow,
          catalogs,
          analysis.source.fingerprint
        );
        newEmployees.push(employee);
        currentCodes[key] = employee;
      });

      // Validate every planned row before the first canonical write. Google
      // Sheets cannot provide a cross-tab transaction, so this preflight keeps
      // schema/data errors from leaving catalog-only partial imports. A quota
      // interruption remains safely retryable because names/codes are reused.
      preflight_(infos.department.table, catalogs.departments.records, context);
      preflight_(infos.position.table, catalogs.positions.records, context);
      preflight_(
        infos.workingCondition.table,
        catalogs.workingConditions.records,
        context
      );
      preflight_(HrSchema.TABLES.EMPLOYEES, newEmployees, context);

      if (catalogs.departments.records.length) {
        HrSheetStore.insertMany(
          infos.department.table,
          catalogs.departments.records,
          { context: context }
        );
      }
      if (catalogs.positions.records.length) {
        HrSheetStore.insertMany(
          infos.position.table,
          catalogs.positions.records,
          { context: context }
        );
      }
      if (catalogs.workingConditions.records.length) {
        HrSheetStore.insertMany(
          infos.workingCondition.table,
          catalogs.workingConditions.records,
          { context: context }
        );
      }
      if (newEmployees.length) {
        HrSheetStore.insertMany(
          HrSchema.TABLES.EMPLOYEES,
          newEmployees,
          { context: context }
        );
      }

      var activeCount = all_(HrSchema.TABLES.EMPLOYEES).filter(function (employee) {
        return employee.record_status !== 'DELETED' &&
          employee.employment_status === 'ACTIVE';
      }).length;
      var appliedSourceCount = all_(HrSchema.TABLES.EMPLOYEES).filter(
        function (employee) {
          var expectedHash = expectedSourceHashes[
            employeeCodeKey_(employee.employee_code)
          ];
          return expectedHash &&
            employee.legacy_system === LEGACY_SYSTEM_ &&
            employee.source_hash === expectedHash;
        }
      ).length;
      var result = {
        stage: 'CONFIRMED',
        replayed: newEmployees.length === 0 && appliedSourceCount > 0,
        message: newEmployees.length
          ? 'Đã nhập dữ liệu nhân sự cũ vào hệ thống.'
          : 'Không có nhân sự mới; các mã số đã tồn tại được bỏ qua an toàn.',
        source: sourceDto_(analysis),
        summary: {
          imported_employees: newEmployees.length,
          skipped_existing_employees: skipped,
          applied_source_employees: appliedSourceCount,
          active_employees_after: activeCount,
          created_departments: catalogs.departments.createdCount,
          reused_departments: catalogs.departments.reusedCount,
          created_positions: catalogs.positions.createdCount,
          reused_positions: catalogs.positions.reusedCount,
          created_working_conditions: catalogs.workingConditions.createdCount,
          reused_working_conditions: catalogs.workingConditions.reusedCount
        }
      };
      if (!hasConfirmationAudit_(analysis.source.fingerprint)) {
        auditConfirmation_(analysis, result, context);
      }
      return result;
    });
  }

  return Object.freeze({
    preview: preview,
    confirm: confirm
  });
})();

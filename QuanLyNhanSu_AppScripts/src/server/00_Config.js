/**
 * Server-only configuration for the HR Apps Script application.
 *
 * Resource identifiers are read from Script Properties. An active spreadsheet
 * fallback is deliberately available only in a development/test environment.
 */
var HrConfig = (function () {
  'use strict';

  var KEYS = Object.freeze({
    APP_ENV: 'APP_ENV',
    APP_RELEASE_VERSION: 'APP_RELEASE_VERSION',
    APP_SCHEMA_VERSION: 'APP_SCHEMA_VERSION',
    PRIMARY_SPREADSHEET_ID: 'PRIMARY_SPREADSHEET_ID',
    PROBATION_TEMPLATE_FILE_ID: 'PROBATION_TEMPLATE_FILE_ID',
    DOCUMENT_ROOT_FOLDER_ID: 'DOCUMENT_ROOT_FOLDER_ID',
    TEMPLATE_ROOT_FOLDER_ID: 'TEMPLATE_ROOT_FOLDER_ID',
    TIME_ZONE: 'TIME_ZONE',
    LOCK_TIMEOUT_MS: 'LOCK_TIMEOUT_MS',
    MAX_PAGE_SIZE: 'MAX_PAGE_SIZE',
    INTERNAL_ACTOR_ID: 'INTERNAL_ACTOR_ID',
    INTERNAL_ACTOR_NAME: 'INTERNAL_ACTOR_NAME'
  });

  var DEFAULTS = Object.freeze({
    APP_ENV: 'development',
    TIME_ZONE: 'Asia/Ho_Chi_Minh',
    LOCK_TIMEOUT_MS: '5000',
    // The current workforce is above 336 records. A 500-row ceiling keeps the
    // initial lightweight employee projection complete while still bounding
    // client payloads; callers can request smaller pages.
    MAX_PAGE_SIZE: '500',
    INTERNAL_ACTOR_ID: 'HR_INTERNAL_SERVICE',
    INTERNAL_ACTOR_NAME: 'HR Internal Service'
  });

  function configError(code, message) {
    var error = new Error(message);
    error.name = 'HrConfigError';
    error.code = code;
    return error;
  }

  function properties_() {
    if (typeof PropertiesService === 'undefined' ||
        !PropertiesService.getScriptProperties) {
      throw configError(
        'CONFIG_RUNTIME_UNAVAILABLE',
        'Script Properties is not available in this runtime.'
      );
    }
    return PropertiesService.getScriptProperties();
  }

  function normalize_(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function get(key, defaultValue) {
    var normalizedKey = normalize_(key);
    if (!normalizedKey) {
      throw configError('CONFIG_KEY_REQUIRED', 'A configuration key is required.');
    }

    var value = normalize_(properties_().getProperty(normalizedKey));
    if (value) return value;
    if (defaultValue !== undefined) return defaultValue;
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, normalizedKey)) {
      return DEFAULTS[normalizedKey];
    }
    return null;
  }

  function getRequired(key) {
    var value = get(key);
    if (value === null || value === undefined || normalize_(value) === '') {
      throw configError(
        'CONFIG_REQUIRED',
        'Required server configuration is missing: ' + normalize_(key) + '.'
      );
    }
    return value;
  }

  function getNumber(key, defaultValue, options) {
    var raw = get(key, defaultValue);
    var value = Number(raw);
    var constraints = options || {};

    if (!isFinite(value)) {
      throw configError('CONFIG_NUMBER_INVALID', normalize_(key) + ' must be numeric.');
    }
    if (constraints.integer !== false && Math.floor(value) !== value) {
      throw configError('CONFIG_NUMBER_INVALID', normalize_(key) + ' must be an integer.');
    }
    if (constraints.min !== undefined && value < constraints.min) {
      throw configError(
        'CONFIG_NUMBER_INVALID',
        normalize_(key) + ' must be at least ' + constraints.min + '.'
      );
    }
    if (constraints.max !== undefined && value > constraints.max) {
      throw configError(
        'CONFIG_NUMBER_INVALID',
        normalize_(key) + ' must not exceed ' + constraints.max + '.'
      );
    }
    return value;
  }

  function getBoolean(key, defaultValue) {
    var raw = get(key, defaultValue === undefined ? false : defaultValue);
    if (typeof raw === 'boolean') return raw;

    var normalized = normalize_(raw).toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    throw configError('CONFIG_BOOLEAN_INVALID', normalize_(key) + ' must be boolean.');
  }

  function environment() {
    return normalize_(get(KEYS.APP_ENV, DEFAULTS.APP_ENV)).toLowerCase();
  }

  function isDevelopment() {
    return ['dev', 'development', 'test', 'local'].indexOf(environment()) >= 0;
  }

  function openSpreadsheet() {
    if (typeof SpreadsheetApp === 'undefined') {
      throw configError(
        'SPREADSHEET_RUNTIME_UNAVAILABLE',
        'Spreadsheet service is not available in this runtime.'
      );
    }

    var spreadsheetId = get(KEYS.PRIMARY_SPREADSHEET_ID);
    if (spreadsheetId) {
      try {
        return SpreadsheetApp.openById(spreadsheetId);
      } catch (error) {
        throw configError(
          'SPREADSHEET_OPEN_FAILED',
          'The configured HR spreadsheet could not be opened.'
        );
      }
    }

    if (!isDevelopment()) {
      throw configError(
        'SPREADSHEET_ID_REQUIRED',
        'PRIMARY_SPREADSHEET_ID is required outside development.'
      );
    }

    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) {
      throw configError(
        'ACTIVE_SPREADSHEET_UNAVAILABLE',
        'No active development spreadsheet is available.'
      );
    }
    return active;
  }

  function validate() {
    var environmentName = environment();
    var spreadsheetId = get(KEYS.PRIMARY_SPREADSHEET_ID);
    if (!spreadsheetId && !isDevelopment()) {
      throw configError(
        'SPREADSHEET_ID_REQUIRED',
        'PRIMARY_SPREADSHEET_ID is required outside development.'
      );
    }

    getNumber(KEYS.LOCK_TIMEOUT_MS, DEFAULTS.LOCK_TIMEOUT_MS, {
      min: 1,
      max: 30000
    });
    getNumber(KEYS.MAX_PAGE_SIZE, DEFAULTS.MAX_PAGE_SIZE, {
      min: 1,
      max: 2000
    });
    getRequired(KEYS.INTERNAL_ACTOR_ID);
    getRequired(KEYS.INTERNAL_ACTOR_NAME);

    return Object.freeze({
      environment: environmentName,
      spreadsheetSource: spreadsheetId ? 'SCRIPT_PROPERTY' : 'ACTIVE_DEVELOPMENT',
      timeZone: get(KEYS.TIME_ZONE, DEFAULTS.TIME_ZONE)
    });
  }

  return Object.freeze({
    KEYS: KEYS,
    get: get,
    getRequired: getRequired,
    getNumber: getNumber,
    getBoolean: getBoolean,
    environment: environment,
    isDevelopment: isDevelopment,
    openSpreadsheet: openSpreadsheet,
    validate: validate
  });
})();

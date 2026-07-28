/**
 * Shared, server-only primitives. This module deliberately has no Session
 * dependency: the current MVP executes under one stable internal actor.
 */
var HrCore = (function () {
  'use strict';

  var SAFE_MESSAGE = 'Không thể hoàn tất thao tác HR.';
  var SENSITIVE_KEY = /(authorization|password|secret|token|cookie|citizen|cccd|identity|insurance|bhxh|bhyt|salary|allowance|address|phone|email|payload|snapshot|file_content)/i;

  function error(code, message, safeDetails) {
    var result = new Error(message || SAFE_MESSAGE);
    result.name = 'HrSafeError';
    result.code = normalizeCode_(code);
    if (safeDetails !== undefined) result.safeDetails = safeDetails;
    return result;
  }

  function assert(condition, code, message, safeDetails) {
    if (!condition) throw error(code, message, safeDetails);
  }

  function normalizeCode_(code) {
    var value = String(code || 'INTERNAL_ERROR').trim().toUpperCase();
    return /^[A-Z][A-Z0-9_]{2,63}$/.test(value) ? value : 'INTERNAL_ERROR';
  }

  function normalizeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function isBlank(value) {
    return value === null || value === undefined ||
      (typeof value === 'string' && value.trim() === '');
  }

  function requireObject(value, fieldName) {
    assert(
      value && typeof value === 'object' && !Array.isArray(value),
      'OBJECT_REQUIRED',
      (fieldName || 'value') + ' must be an object.'
    );
    return value;
  }

  function requireString(value, fieldName, maxLength) {
    var normalized = normalizeString(value);
    assert(normalized, 'FIELD_REQUIRED', (fieldName || 'value') + ' is required.');
    if (maxLength) {
      assert(
        normalized.length <= maxLength,
        'FIELD_TOO_LONG',
        (fieldName || 'value') + ' is too long.'
      );
    }
    return normalized;
  }

  function parseInteger(value, fieldName, options) {
    var parsed = Number(value);
    var constraints = options || {};
    assert(
      isFinite(parsed) && Math.floor(parsed) === parsed,
      'INTEGER_REQUIRED',
      (fieldName || 'value') + ' must be an integer.'
    );
    if (constraints.min !== undefined) {
      assert(
        parsed >= constraints.min,
        'INTEGER_OUT_OF_RANGE',
        (fieldName || 'value') + ' is below the allowed range.'
      );
    }
    if (constraints.max !== undefined) {
      assert(
        parsed <= constraints.max,
        'INTEGER_OUT_OF_RANGE',
        (fieldName || 'value') + ' exceeds the allowed range.'
      );
    }
    return parsed;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid() {
    assert(
      typeof Utilities !== 'undefined' && Utilities.getUuid,
      'UUID_RUNTIME_UNAVAILABLE',
      'UUID generation is not available.'
    );
    return Utilities.getUuid();
  }

  function context(requestId) {
    var actor = Object.freeze({
      id: HrConfig.getRequired(HrConfig.KEYS.INTERNAL_ACTOR_ID),
      displayName: HrConfig.getRequired(HrConfig.KEYS.INTERNAL_ACTOR_NAME),
      type: 'INTERNAL'
    });
    return Object.freeze({
      actor: actor,
      requestId: normalizeString(requestId) || uuid(),
      occurredAt: nowIso()
    });
  }

  function canonicalize_(value, seen) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();

    var type = typeof value;
    if (type === 'string' || type === 'boolean') return value;
    if (type === 'number') {
      assert(isFinite(value), 'JSON_NUMBER_INVALID', 'A numeric value is not finite.');
      return value;
    }
    if (type !== 'object') return String(value);

    assert(seen.indexOf(value) < 0, 'JSON_CYCLE', 'Cyclic data cannot be serialized.');
    seen.push(value);

    var result;
    if (Array.isArray(value)) {
      result = value.map(function (item) {
        return canonicalize_(item, seen);
      });
    } else {
      result = {};
      Object.keys(value).sort().forEach(function (key) {
        if (value[key] !== undefined && typeof value[key] !== 'function') {
          result[key] = canonicalize_(value[key], seen);
        }
      });
    }
    seen.pop();
    return result;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalize_(value, []));
  }

  function safeJsonParse(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (parseError) {
      return fallback;
    }
  }

  function sha256(value) {
    assert(
      typeof Utilities !== 'undefined' &&
        Utilities.computeDigest &&
        Utilities.DigestAlgorithm &&
        Utilities.Charset,
      'DIGEST_RUNTIME_UNAVAILABLE',
      'SHA-256 is not available.'
    );
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      typeof value === 'string' ? value : canonicalJson(value),
      Utilities.Charset.UTF_8
    );
    return bytes.map(function (byte) {
      return ((byte + 256) % 256).toString(16).padStart(2, '0');
    }).join('');
  }

  function sanitizeText(value) {
    var text = String(value || SAFE_MESSAGE);
    text = text
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, '[REDACTED]')
      .replace(/https?:\/\/(?:docs|drive)\.google\.com\/[^\s]+/gi, '[REDACTED_URL]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
      .replace(/\b\d{9,16}\b/g, '[REDACTED_NUMBER]')
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[REDACTED_TOKEN]')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return (text || SAFE_MESSAGE).slice(0, 300);
  }

  function sanitizeError(source) {
    var candidate = source || {};
    var sourceCode = candidate.code || candidate.name;
    var code = sourceCode && /^[A-Z][A-Z0-9_]{2,63}$/.test(String(sourceCode))
      ? String(sourceCode)
      : 'INTERNAL_ERROR';
    var message = candidate.name === 'HrSafeError' || candidate.code
      ? sanitizeText(candidate.message)
      : SAFE_MESSAGE;
    return Object.freeze({
      code: normalizeCode_(code),
      message: message
    });
  }

  function sanitizeMetadata(value, depth) {
    var currentDepth = depth || 0;
    if (currentDepth > 4) return '[TRUNCATED]';
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return sanitizeText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;

    if (Array.isArray(value)) {
      return value.slice(0, 20).map(function (item) {
        return sanitizeMetadata(item, currentDepth + 1);
      });
    }

    if (typeof value === 'object') {
      var result = {};
      Object.keys(value).slice(0, 50).forEach(function (key) {
        result[key] = SENSITIVE_KEY.test(key)
          ? '[REDACTED]'
          : sanitizeMetadata(value[key], currentDepth + 1);
      });
      return result;
    }
    return sanitizeText(value);
  }

  function changedFields(before, after) {
    var left = before || {};
    var right = after || {};
    var keys = {};
    Object.keys(left).forEach(function (key) { keys[key] = true; });
    Object.keys(right).forEach(function (key) { keys[key] = true; });
    return Object.keys(keys).filter(function (key) {
      return canonicalJson(left[key]) !== canonicalJson(right[key]);
    }).sort();
  }

  function clone(value) {
    return safeJsonParse(canonicalJson(value), null);
  }

  return Object.freeze({
    error: error,
    assert: assert,
    normalizeString: normalizeString,
    isBlank: isBlank,
    requireObject: requireObject,
    requireString: requireString,
    parseInteger: parseInteger,
    nowIso: nowIso,
    uuid: uuid,
    context: context,
    canonicalJson: canonicalJson,
    safeJsonParse: safeJsonParse,
    sha256: sha256,
    sanitizeText: sanitizeText,
    sanitizeError: sanitizeError,
    sanitizeMetadata: sanitizeMetadata,
    changedFields: changedFields,
    clone: clone
  });
})();

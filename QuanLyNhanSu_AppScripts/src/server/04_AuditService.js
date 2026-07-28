/**
 * Append-only, PII-minimized audit writer.
 *
 * Raw records and payloads are never persisted here. Changes are represented
 * by field names, hashes and sanitized metadata only.
 */
var HrAuditService = (function () {
  'use strict';

  function normalizeChangedFields_(fields) {
    if (!Array.isArray(fields)) return [];
    var unique = {};
    fields.forEach(function (field) {
      var normalized = HrCore.normalizeString(field);
      if (/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(normalized)) {
        unique[normalized] = true;
      }
    });
    return Object.keys(unique).sort();
  }

  function optionalHash_(value, suppliedHash) {
    if (suppliedHash) return String(suppliedHash).toLowerCase();
    if (value === null || value === undefined) return null;
    return HrCore.sha256(value);
  }

  function record(input) {
    var request = HrCore.requireObject(input, 'audit');
    var context = request.context || HrCore.context(request.requestId);
    var actor = context.actor;
    var result = String(request.result || 'SUCCESS').toUpperCase();
    HrCore.assert(
      ['SUCCESS', 'DENIED', 'FAILED'].indexOf(result) >= 0,
      'AUDIT_RESULT_INVALID',
      'Audit result is invalid.'
    );

    var changedFields = normalizeChangedFields_(request.changedFields);
    var metadata = HrCore.sanitizeMetadata(request.metadata || {});
    var safeError = request.error ? HrCore.sanitizeError(request.error) : null;
    var errorCode = request.errorCode || (safeError && safeError.code) || null;
    var occurredAt = request.occurredAt || context.occurredAt || HrCore.nowIso();
    var auditPayload = {
      request_id: context.requestId,
      actor_id: actor.id,
      actor_display_name: actor.displayName,
      actor_type: actor.type,
      action: HrCore.requireString(request.action, 'action', 100).toUpperCase(),
      entity_type: HrCore.requireString(request.entityType, 'entityType', 100).toUpperCase(),
      entity_id: request.entityId === null || request.entityId === undefined
        ? null
        : String(request.entityId),
      changed_fields_json: changedFields,
      before_hash: optionalHash_(request.before, request.beforeHash),
      after_hash: optionalHash_(request.after, request.afterHash),
      sanitized_metadata_json: metadata,
      result: result,
      error_code: errorCode ? String(errorCode).toUpperCase() : null,
      occurred_at: occurredAt,
      created_at: occurredAt,
      created_by: actor.id,
      source_hash: null
    };
    auditPayload.source_hash = HrCore.sha256({
      request_id: auditPayload.request_id,
      actor_id: auditPayload.actor_id,
      action: auditPayload.action,
      entity_type: auditPayload.entity_type,
      entity_id: auditPayload.entity_id,
      changed_fields: changedFields,
      before_hash: auditPayload.before_hash,
      after_hash: auditPayload.after_hash,
      result: result,
      occurred_at: occurredAt
    });
    return HrSheetStore.insert(HrSchema.TABLES.AUDIT_LOGS, auditPayload, {
      context: context
    });
  }

  function change(input) {
    var request = HrCore.requireObject(input, 'changeAudit');
    return record({
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      before: request.before,
      after: request.after,
      changedFields: request.changedFields ||
        HrCore.changedFields(request.before || {}, request.after || {}),
      metadata: request.metadata,
      result: request.result || 'SUCCESS',
      error: request.error,
      errorCode: request.errorCode,
      context: request.context,
      requestId: request.requestId,
      occurredAt: request.occurredAt
    });
  }

  function denied(input) {
    var request = HrCore.requireObject(input, 'deniedAudit');
    return record({
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      changedFields: [],
      metadata: request.metadata,
      result: 'DENIED',
      errorCode: request.errorCode || 'ACCESS_DENIED',
      context: request.context,
      requestId: request.requestId,
      occurredAt: request.occurredAt
    });
  }

  function failure(input) {
    var request = HrCore.requireObject(input, 'failureAudit');
    return record({
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      before: request.before,
      after: request.after,
      changedFields: request.changedFields,
      metadata: request.metadata,
      result: 'FAILED',
      error: request.error,
      errorCode: request.errorCode,
      context: request.context,
      requestId: request.requestId,
      occurredAt: request.occurredAt
    });
  }

  return Object.freeze({
    record: record,
    change: change,
    denied: denied,
    failure: failure
  });
})();

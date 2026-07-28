/**
 * Private Google Docs probation-contract generation service.
 *
 * Public API:
 *   HrDocumentService.generateProbationContract(candidateId, request, options)
 *   HrDocumentService.list(query)
 *   HrDocumentService.listHistory(candidateId, query)
 *   HrDocumentService.get(documentId, options)
 *   HrDocumentService.getDownloadLinks(documentId, options)
 *   HrDocumentService.voidDocument(documentId, expectedVersion, reason, options)
 *
 * Template and root folder IDs are always resolved from HrConfig. They are
 * never accepted from the client. Files are never shared by link.
 */
var HrDocumentService = (function () {
  'use strict';

  var DOCUMENTS_ = null;
  var CANDIDATES_ = null;
  var TEMPLATES_ = null;
  var DOCX_MIME_ = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var PLACEHOLDERS_ = Object.freeze([
    '{{CONTRACT_NO}}',
    '{{CONTRACT_YEAR}}',
    '{{SIGN_DAY}}',
    '{{SIGN_MONTH}}',
    '{{SIGN_YEAR}}',
    '{{CANDIDATE_TITLE}}',
    '{{FULL_NAME}}',
    '{{NATIONALITY}}',
    '{{DATE_OF_BIRTH}}',
    '{{BIRTH_PLACE}}',
    '{{PERMANENT_ADDRESS}}',
    '{{CITIZEN_ID}}',
    '{{CITIZEN_ID_ISSUED_DATE}}',
    '{{CITIZEN_ID_ISSUED_PLACE}}',
    '{{PROBATION_CONTRACT_TYPE}}',
    '{{PROBATION_START_DATE}}',
    '{{PROBATION_END_DATE}}',
    '{{POSITION_NAME}}',
    '{{JOB_DESCRIPTION}}',
    '{{BASE_SALARY_TEXT}}',
    '{{SALARY_NOTE}}',
    '{{DEPARTMENT_RULE_NOTE}}'
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

  function bootstrap_() {
    HrSheetStore.bootstrap();
    DOCUMENTS_ = DOCUMENTS_ || HrSchema.TABLES.GENERATED_DOCUMENTS;
    CANDIDATES_ = CANDIDATES_ || HrSchema.TABLES.PROBATION_CANDIDATES;
    TEMPLATES_ = TEMPLATES_ || HrSchema.TABLES.PROBATION_JOB_TEMPLATES;
    assert_(DOCUMENTS_ && CANDIDATES_ && TEMPLATES_,
      'DOCUMENT_SCHEMA_MISSING',
      'Chưa cấu hình bảng tài liệu.');
  }

  function context_(options) {
    options = options || {};
    return options.context || HrCore.context(options.requestId);
  }

  function actor_(context) {
    return context && (
      context.actorId || context.actor_id ||
      (context.actor && context.actor.id)
    ) || null;
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function all_(table) {
    return rows_(HrSheetStore.list(table));
  }

  function trim_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function code_(value, fallback) {
    var result = trim_(value || fallback).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
    return result || fallback;
  }

  function businessToday_() {
    return Utilities.formatDate(
      new Date(),
      HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
      'yyyy-MM-dd'
    );
  }

  function date_(value, field, required) {
    if (value === null || value === undefined || value === '') {
      assert_(!required, 'DOCUMENT_DATE_REQUIRED', 'Thiếu ngày bắt buộc.', { field: field });
      return null;
    }
    var text = Object.prototype.toString.call(value) === '[object Date]'
      ? Utilities.formatDate(value, HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'), 'yyyy-MM-dd')
      : trim_(value);
    assert_(/^\d{4}-\d{2}-\d{2}$/.test(text),
      'DOCUMENT_DATE_INVALID',
      'Ngày phải có định dạng yyyy-MM-dd.',
      { field: field });
    var parsed = new Date(text + 'T00:00:00Z');
    assert_(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text,
      'DOCUMENT_DATE_INVALID',
      'Ngày không hợp lệ.',
      { field: field });
    return text;
  }

  function displayDate_(value) {
    var iso = date_(value, 'render_date', true);
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  }

  function formatMoney_(value) {
    var amount = Number(value);
    assert_(isFinite(amount) && amount >= 0,
      'DOCUMENT_SALARY_INVALID',
      'Mức lương thử việc không hợp lệ.');
    var rounded = Math.round(amount);
    return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function salarySuffix_(value) {
    var suffix = trim_(value).replace(/^đồng\s*\/\s*tháng/i, '');
    if (!suffix) return '';
    return /^\s/.test(suffix) ? suffix : ' ' + suffix;
  }

  function getCandidate_(candidateId) {
    var candidate = HrSheetStore.get(CANDIDATES_, candidateId);
    assert_(candidate && candidate.record_status !== 'DELETED',
      'CANDIDATE_NOT_FOUND',
      'Không tìm thấy ứng viên thử việc.');
    assert_(['DRAFT', 'CONTRACT_CREATED'].indexOf(candidate.candidate_status) >= 0,
      'CANDIDATE_DOCUMENT_STATUS_INVALID',
      'Trạng thái ứng viên không cho phép sinh hợp đồng.');
    return candidate;
  }

  function getJobTemplate_(candidate) {
    if (!candidate.job_template_id) return null;
    var template = HrSheetStore.get(TEMPLATES_, candidate.job_template_id);
    assert_(template && template.record_status !== 'DELETED',
      'JOB_TEMPLATE_NOT_FOUND',
      'Không tìm thấy mẫu công việc đã chọn.');
    assert_(template.template_status === 'ACTIVE',
      'JOB_TEMPLATE_NOT_ACTIVE',
      'Mẫu công việc đã chọn không còn ACTIVE.');
    return template;
  }

  function positionName_(candidate, template) {
    var positionId = candidate.position_id || (template && template.position_id);
    if (positionId && HrSchema.TABLES.POSITIONS) {
      var position = HrSheetStore.get(HrSchema.TABLES.POSITIONS, positionId);
      if (position && position.record_status !== 'DELETED') return trim_(position.name);
    }
    return trim_(template && template.name) || 'Nhân viên thử việc';
  }

  function renderContext_(candidate, template, signDate, contractNo) {
    var gender = trim_(candidate.gender).toUpperCase();
    var fields = {
      candidate_title: trim_(candidate.candidate_title) ||
        (gender === 'FEMALE' ? 'Bà' : gender === 'MALE' ? 'Ông' : 'Ông/Bà'),
      full_name: trim_(candidate.full_name),
      nationality: trim_(candidate.nationality) || 'Việt Nam',
      date_of_birth: candidate.date_of_birth,
      birth_place: trim_(candidate.birth_place),
      permanent_address: trim_(candidate.permanent_address),
      citizen_id: trim_(candidate.citizen_id),
      citizen_id_issued_date: candidate.citizen_id_issued_date,
      citizen_id_issued_place: trim_(candidate.citizen_id_issued_place),
      probation_contract_type: trim_(candidate.probation_contract_type) ||
        trim_(template && template.probation_contract_type) ||
        'Xác định thời hạn 02 tháng',
      probation_start_date: candidate.probation_start_date,
      probation_end_date: candidate.probation_end_date,
      position_name: positionName_(candidate, template),
      job_description: trim_(candidate.job_description),
      base_salary_amount: candidate.base_salary_amount,
      salary_note_suffix: salarySuffix_(candidate.salary_note_suffix),
      department_rule_note: trim_(candidate.department_rule_note) ||
        trim_(template && template.department_rule_note)
    };
    [
      'candidate_title', 'full_name', 'nationality', 'date_of_birth',
      'birth_place', 'permanent_address', 'citizen_id',
      'citizen_id_issued_date', 'citizen_id_issued_place',
      'probation_contract_type', 'probation_start_date',
      'probation_end_date', 'position_name', 'job_description',
      'base_salary_amount'
    ].forEach(function (field) {
      assert_(fields[field] !== null && fields[field] !== undefined && fields[field] !== '',
        'DOCUMENT_REQUIRED_FIELD_MISSING',
        'Hồ sơ ứng viên chưa đủ dữ liệu để sinh hợp đồng.',
        { field: field });
    });
    assert_(fields.probation_end_date >= fields.probation_start_date,
      'DOCUMENT_PROBATION_RANGE_INVALID',
      'Ngày kết thúc thử việc không được trước ngày bắt đầu.');

    return {
      '{{CONTRACT_NO}}': contractNo,
      '{{CONTRACT_YEAR}}': signDate.slice(0, 4),
      '{{SIGN_DAY}}': signDate.slice(8, 10),
      '{{SIGN_MONTH}}': signDate.slice(5, 7),
      '{{SIGN_YEAR}}': signDate.slice(0, 4),
      '{{CANDIDATE_TITLE}}': fields.candidate_title,
      '{{FULL_NAME}}': fields.full_name.toUpperCase(),
      '{{NATIONALITY}}': fields.nationality,
      '{{DATE_OF_BIRTH}}': displayDate_(fields.date_of_birth),
      '{{BIRTH_PLACE}}': fields.birth_place,
      '{{PERMANENT_ADDRESS}}': fields.permanent_address,
      '{{CITIZEN_ID}}': fields.citizen_id,
      '{{CITIZEN_ID_ISSUED_DATE}}': displayDate_(fields.citizen_id_issued_date),
      '{{CITIZEN_ID_ISSUED_PLACE}}': fields.citizen_id_issued_place,
      '{{PROBATION_CONTRACT_TYPE}}': fields.probation_contract_type,
      '{{PROBATION_START_DATE}}': displayDate_(fields.probation_start_date),
      '{{PROBATION_END_DATE}}': displayDate_(fields.probation_end_date),
      '{{POSITION_NAME}}': fields.position_name,
      '{{JOB_DESCRIPTION}}': fields.job_description,
      '{{BASE_SALARY_TEXT}}': formatMoney_(fields.base_salary_amount),
      '{{SALARY_NOTE}}': fields.salary_note_suffix,
      '{{DEPARTMENT_RULE_NOTE}}': fields.department_rule_note
    };
  }

  function templateContainers_(doc) {
    var result = [doc.getBody()];
    var header = doc.getHeader();
    var footer = doc.getFooter();
    if (header) result.push(header);
    if (footer) result.push(footer);
    return result;
  }

  function documentText_(doc) {
    return templateContainers_(doc).map(function (container) {
      return container.getText();
    }).join('\n');
  }

  function tokens_(text) {
    return String(text || '').match(/\{\{[A-Z0-9_]+\}\}/g) || [];
  }

  function preflightTemplate_(doc) {
    var found = tokens_(documentText_(doc));
    var expected = {};
    PLACEHOLDERS_.forEach(function (token) { expected[token] = true; });
    var unknown = found.filter(function (token) { return !expected[token]; });
    assert_(unknown.length === 0,
      'DOCUMENT_TEMPLATE_UNKNOWN_PLACEHOLDER',
      'Mẫu tài liệu có placeholder không thuộc schema.',
      { unknown_placeholders: unknown });
    PLACEHOLDERS_.forEach(function (token) {
      var count = found.filter(function (value) { return value === token; }).length;
      assert_(count === 1,
        'DOCUMENT_TEMPLATE_PLACEHOLDER_COUNT_INVALID',
        'Mỗi placeholder bắt buộc phải xuất hiện đúng một lần.',
        { placeholder: token, count: count });
    });
  }

  function escapePattern_(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeReplacement_(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\$/g, '\\$');
  }

  function render_(doc, replacements) {
    preflightTemplate_(doc);
    var containers = templateContainers_(doc);
    PLACEHOLDERS_.forEach(function (token) {
      containers.forEach(function (container) {
        container.replaceText(escapePattern_(token), escapeReplacement_(replacements[token]));
      });
    });
    var remaining = tokens_(documentText_(doc));
    assert_(remaining.length === 0,
      'DOCUMENT_PLACEHOLDER_REMAINS',
      'Tài liệu còn placeholder sau khi render.',
      { remaining_placeholders: remaining });
  }

  function ensureNoPublicSharing_(resource) {
    if (!resource) return;
    try {
      resource.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (ignored) {
      // Shared Drive resources can reject setSharing; the explicit access
      // inspection below remains the fail-closed privacy gate.
    }
    if (typeof resource.getSharingAccess === 'function') {
      var access = resource.getSharingAccess();
      if (access === DriveApp.Access.ANYONE ||
          access === DriveApp.Access.ANYONE_WITH_LINK) {
        fail_(
          'DOCUMENT_PUBLIC_SHARING_FORBIDDEN',
          'Tài liệu HR không được phép chia sẻ công khai.'
        );
      }
    }
  }

  function childFolder_(parent, name) {
    var iterator = parent.getFoldersByName(name);
    var folder = iterator.hasNext() ? iterator.next() : parent.createFolder(name);
    ensureNoPublicSharing_(folder);
    return folder;
  }

  function createPrivateFolder_(documentId, year) {
    var rootId = HrConfig.getRequired('DOCUMENT_ROOT_FOLDER_ID');
    var root = DriveApp.getFolderById(rootId);
    ensureNoPublicSharing_(root);
    var yearFolder = childFolder_(root, String(year));
    return childFolder_(yearFolder, documentId);
  }

  function blobSha256_(blob) {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      blob.getBytes()
    );
    return digest.map(function (byte) {
      return ((byte + 256) % 256).toString(16).padStart(2, '0');
    }).join('');
  }

  function exportDocx_(googleDocFile, folder, fileName) {
    var blob = null;
    if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.export === 'function') {
      blob = Drive.Files.export(googleDocFile.getId(), DOCX_MIME_);
    } else if (typeof googleDocFile.getAs === 'function') {
      try {
        blob = googleDocFile.getAs(DOCX_MIME_);
      } catch (ignored) {
        blob = null;
      }
    }
    if (!blob) return null;
    blob.setName(fileName + '.docx');
    var file = folder.createFile(blob);
    ensureNoPublicSharing_(file);
    return { file: file, sha256: blobSha256_(blob) };
  }

  function exportPdf_(googleDocFile, folder, fileName) {
    var blob = googleDocFile.getAs(MimeType.PDF).setName(fileName + '.pdf');
    var file = folder.createFile(blob);
    ensureNoPublicSharing_(file);
    return { file: file, sha256: blobSha256_(blob) };
  }

  function nextContractNo_(contractYear) {
    var year = Number(contractYear);
    var max = 0;
    all_(DOCUMENTS_).forEach(function (row) {
      if (Number(row.contract_year) !== year || !row.contract_no) return;
      var value = trim_(row.contract_no);
      var match = value.match(/^(\d+)$/) || value.match(/\/(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    });
    var next = max + 1;
    return String(next).padStart(2, '0');
  }

  function safeResult_(row) {
    return {
      generated_document_id: row.generated_document_id,
      document_type: row.document_type,
      candidate_id: row.candidate_id || null,
      contract_no: row.contract_no || null,
      contract_year: row.contract_year || null,
      generation_status: row.generation_status,
      document_template_version: row.document_template_version,
      placeholder_schema_version: row.placeholder_schema_version,
      generated_at: row.generated_at || null,
      generated_by: row.generated_by || null,
      has_google_doc: !!row.google_doc_file_id,
      has_docx: !!row.docx_file_id,
      has_pdf: !!row.pdf_file_id,
      supersedes_document_id: row.supersedes_document_id || null,
      superseded_by_id: row.superseded_by_id || null,
      row_version: row.row_version
    };
  }

  function auditView_(row) {
    if (!row) return null;
    return {
      generated_document_id: row.generated_document_id,
      document_type: row.document_type,
      candidate_id: row.candidate_id || null,
      generation_status: row.generation_status,
      contract_year: row.contract_year || null,
      row_version: row.row_version
    };
  }

  function audit_(action, before, after, context, metadata) {
    if (typeof HrAuditService === 'undefined' || typeof HrAuditService.change !== 'function') return;
    HrAuditService.change({
      action: action,
      entityType: 'GENERATED_DOCUMENT',
      entityId: (after || before).generated_document_id,
      before: auditView_(before),
      after: auditView_(after),
      context: context,
      metadata: metadata || {}
    });
  }

  function markFailed_(documentId, error, context) {
    if (!documentId) return;
    var current = HrSheetStore.get(DOCUMENTS_, documentId);
    if (!current ||
        ['PROCESSING', 'GENERATED'].indexOf(current.generation_status) < 0) return;
    var safe = HrCore.sanitizeError(error);
    var failed = HrSheetStore.update(DOCUMENTS_, documentId, {
      generation_status: 'FAILED',
      error_code: code_(safe.code, 'DOCUMENT_GENERATION_FAILED')
    }, current.row_version, { context: context });
    audit_('DOCUMENT_GENERATION_FAILED', current, failed, context, {
      error_code: safe.code
    });
  }

  function validateSupersedes_(candidateId, documentId) {
    if (!documentId) return null;
    var current = HrSheetStore.get(DOCUMENTS_, documentId);
    assert_(current &&
      current.record_status !== 'DELETED' &&
      current.candidate_id === candidateId &&
      current.generation_status === 'GENERATED',
    'DOCUMENT_SUPERSEDE_TARGET_INVALID',
    'Tài liệu bị thay thế không hợp lệ.');
    return current;
  }

  function generateProbationContract(candidateId, request, options) {
    bootstrap_();
    request = request || {};
    options = options || {};
    assert_(trim_(candidateId), 'CANDIDATE_ID_REQUIRED', 'ID ứng viên là bắt buộc.');
    var idempotencyKey = options.idempotencyKey || request.idempotency_key;
    assert_(trim_(idempotencyKey),
      'IDEMPOTENCY_KEY_REQUIRED',
      'Thiếu idempotency key khi sinh hợp đồng.');
    var context = context_(options);

    return HrSheetStore.withIdempotency('PROBATION_DOCUMENT_GENERATE', idempotencyKey, function (operation) {
      var candidate = getCandidate_(candidateId);
      var jobTemplate = getJobTemplate_(candidate);
      var signDate = date_(request.sign_date || businessToday_(), 'sign_date', true);
      var year = Number(signDate.slice(0, 4));
      var generatedDocumentId = HrCore.uuid();
      var supersedes = validateSupersedes_(candidateId, trim_(request.supersedes_document_id));
      var templateFileId = HrConfig.getRequired('PROBATION_TEMPLATE_FILE_ID');
      var templateDoc = DocumentApp.openById(templateFileId);
      preflightTemplate_(templateDoc);
      var templateHash = HrCore.sha256(documentText_(templateDoc));
      var templateVersion = code_(HrConfig.get('PROBATION_TEMPLATE_VERSION', 'V1'), 'V1');
      var schemaVersion = code_(
        HrConfig.get('PROBATION_PLACEHOLDER_SCHEMA_VERSION', 'PC22_V1'),
        'PC22_V1'
      );
      var folder = createPrivateFolder_(generatedDocumentId, year);
      var inserted = null;

      try {
        inserted = HrSheetStore.withLock(function () {
          var contractNo = nextContractNo_(year);
          var replacements = renderContext_(candidate, jobTemplate, signDate, contractNo);
          var payloadHash = HrCore.sha256(HrCore.canonicalJson(replacements));
          var record = {
            generated_document_id: generatedDocumentId,
            operation_id: operation.operationId,
            document_type: 'PROBATION_CONTRACT',
            document_template_id: templateFileId,
            document_template_version: templateVersion,
            document_template_hash: templateHash,
            candidate_id: candidateId,
            job_template_id: jobTemplate && jobTemplate.job_template_id || null,
            job_template_version: jobTemplate && jobTemplate.version || null,
            job_template_hash: jobTemplate && jobTemplate.content_sha256 || null,
            contract_no: contractNo,
            contract_year: year,
            placeholder_schema_version: schemaVersion,
            secure_snapshot_ref: 'PENDING:' + operation.operationId,
            render_payload_hash: payloadHash,
            private_folder_id: folder.getId(),
            generation_status: 'PROCESSING',
            supersedes_document_id: supersedes && supersedes.generated_document_id || null,
            record_status: 'ACTIVE'
          };
          record._replacements = replacements;
          var persisted = {};
          Object.keys(record).forEach(function (field) {
            if (field !== '_replacements') persisted[field] = record[field];
          });
          var created = HrSheetStore.insert(DOCUMENTS_, persisted, { context: context });
          created._replacements = replacements;
          return created;
        }, Number(HrConfig.get('LOCK_TIMEOUT_MS', 5000)));

        var replacements = inserted._replacements;
        delete inserted._replacements;
        var snapshotBlob = Utilities.newBlob(
          HrCore.canonicalJson(replacements),
          'application/json',
          'render-snapshot.json'
        );
        var snapshotFile = folder.createFile(snapshotBlob);
        ensureNoPublicSharing_(snapshotFile);
        var processing = HrSheetStore.get(DOCUMENTS_, generatedDocumentId);
        processing = HrSheetStore.update(DOCUMENTS_, generatedDocumentId, {
          secure_snapshot_ref: snapshotFile.getId()
        }, processing.row_version, { context: context });

        var templateFile = DriveApp.getFileById(processing.document_template_id);
        ensureNoPublicSharing_(templateFile);
        var baseName = 'HĐTV_' + processing.contract_year + '_' +
          String(processing.contract_no).split('/').pop() + '_' +
          generatedDocumentId.slice(0, 8);
        var googleDocFile = templateFile.makeCopy(baseName, folder);
        ensureNoPublicSharing_(googleDocFile);
        var generatedDoc = DocumentApp.openById(googleDocFile.getId());
        render_(generatedDoc, replacements);
        var renderedText = documentText_(generatedDoc);
        generatedDoc.saveAndClose();

        googleDocFile = DriveApp.getFileById(googleDocFile.getId());
        var pdf = exportPdf_(googleDocFile, folder, baseName);
        var docx = exportDocx_(googleDocFile, folder, baseName);
        processing = HrSheetStore.get(DOCUMENTS_, generatedDocumentId);
        var completed = HrSheetStore.update(DOCUMENTS_, generatedDocumentId, {
          google_doc_file_id: googleDocFile.getId(),
          google_doc_sha256: HrCore.sha256(renderedText),
          docx_file_id: docx && docx.file.getId() || null,
          docx_sha256: docx && docx.sha256 || null,
          pdf_file_id: pdf.file.getId(),
          pdf_sha256: pdf.sha256,
          generation_status: 'GENERATED',
          generated_at: HrCore.nowIso(),
          generated_by: actor_(context),
          error_code: null
        }, processing.row_version, { context: context });

        if (supersedes) {
          var previous = HrSheetStore.get(DOCUMENTS_, supersedes.generated_document_id);
          HrSheetStore.update(DOCUMENTS_, previous.generated_document_id, {
            generation_status: 'SUPERSEDED',
            superseded_by_id: generatedDocumentId
          }, previous.row_version, { context: context });
        }

        var freshCandidate = HrSheetStore.get(CANDIDATES_, candidateId);
        if (freshCandidate && freshCandidate.candidate_status === 'DRAFT') {
          HrProbationService.markContractCreated(
            candidateId,
            generatedDocumentId,
            freshCandidate.row_version,
            { context: context }
          );
        }
        audit_('DOCUMENT_GENERATED', null, completed, context, {
          has_pdf: true,
          has_docx: !!docx,
          placeholder_count: PLACEHOLDERS_.length
        });
        return safeResult_(completed);
      } catch (error) {
        markFailed_(generatedDocumentId, error, context);
        if (supersedes) {
          try {
            var superseded = HrSheetStore.get(DOCUMENTS_, supersedes.generated_document_id);
            if (superseded &&
                superseded.generation_status === 'SUPERSEDED' &&
                superseded.superseded_by_id === generatedDocumentId) {
              HrSheetStore.update(DOCUMENTS_, superseded.generated_document_id, {
                generation_status: 'GENERATED',
                superseded_by_id: null
              }, superseded.row_version, { context: context });
            }
          } catch (ignoredRestore) {
            // Reconciliation will flag this rare multi-resource partial failure.
          }
        }
        try {
          folder.setTrashed(true);
        } catch (ignored) {
          // The failed metadata row remains the reconciliation anchor.
        }
        throw error;
      }
    }, {
      aggregateType: 'GENERATED_DOCUMENT',
      aggregateId: candidateId,
      context: context,
      holdLock: false,
      resultRef: function (result) {
        return result && result.generated_document_id || null;
      },
      replayResolver: function (documentId) {
        var row = documentId && HrSheetStore.get(DOCUMENTS_, documentId);
        return row ? safeResult_(row) : null;
      }
    });
  }

  function paginate_(items, query) {
    query = query || {};
    var maxSize = Number(HrConfig.get('MAX_PAGE_SIZE', 100)) || 100;
    var pageSize = Math.min(Math.max(Number(query.pageSize || query.limit || 25), 1), maxSize);
    var page = Math.max(Number(query.page || 1), 1);
    var offset = query.offset === undefined ? (page - 1) * pageSize : Math.max(Number(query.offset), 0);
    return {
      items: items.slice(offset, offset + pageSize),
      total: items.length,
      page: Math.floor(offset / pageSize) + 1,
      pageSize: pageSize,
      totalPages: Math.ceil(items.length / pageSize)
    };
  }

  function list(query) {
    bootstrap_();
    query = query || {};
    var candidateId = trim_(query.candidate_id);
    var status = trim_(query.status || query.generation_status).toUpperCase();
    var year = query.contract_year === undefined || query.contract_year === ''
      ? null
      : Number(query.contract_year);
    var items = all_(DOCUMENTS_).filter(function (row) {
      if (row.record_status === 'DELETED') return false;
      if (candidateId && row.candidate_id !== candidateId) return false;
      if (status && status !== 'ALL' && row.generation_status !== status) return false;
      if (year !== null && Number(row.contract_year) !== year) return false;
      return true;
    }).map(safeResult_);
    items.sort(function (left, right) {
      return String(right.generated_at || '').localeCompare(String(left.generated_at || ''));
    });
    return paginate_(items, query);
  }

  function listHistory(candidateId, query) {
    query = query || {};
    var merged = {};
    Object.keys(query).forEach(function (key) { merged[key] = query[key]; });
    merged.candidate_id = candidateId;
    return list(merged);
  }

  function get(documentId, options) {
    bootstrap_();
    options = options || {};
    var row = HrSheetStore.get(DOCUMENTS_, documentId);
    assert_(row && row.record_status !== 'DELETED', 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.');
    if (!options.includeStorageIds) return safeResult_(row);
    var result = safeResult_(row);
    [
      'private_folder_id', 'google_doc_file_id', 'docx_file_id', 'pdf_file_id',
      'google_doc_sha256', 'docx_sha256', 'pdf_sha256',
      'document_template_hash', 'render_payload_hash'
    ].forEach(function (field) {
      result[field] = row[field] || null;
    });
    return result;
  }

  function getDownloadLinks(documentId, options) {
    bootstrap_();
    options = options || {};
    var row = HrSheetStore.get(DOCUMENTS_, documentId);
    assert_(row && row.record_status !== 'DELETED', 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.');
    assert_(
      ['GENERATED', 'SUPERSEDED', 'VOIDED'].indexOf(row.generation_status) >= 0,
      'DOCUMENT_DOWNLOAD_STATUS_INVALID',
      'Tài liệu chưa sẵn sàng để mở hoặc tải.'
    );

    function restrictedUrl_(fileId) {
      if (!fileId) return null;
      var file = DriveApp.getFileById(fileId);
      ensureNoPublicSharing_(file);
      return file.getUrl();
    }

    var result = {
      generated_document_id: documentId,
      generation_status: row.generation_status,
      google_doc_url: restrictedUrl_(row.google_doc_file_id),
      docx_url: restrictedUrl_(row.docx_file_id),
      pdf_url: restrictedUrl_(row.pdf_file_id)
    };
    if (typeof HrAuditService !== 'undefined' && typeof HrAuditService.record === 'function') {
      HrAuditService.record({
        action: 'DOCUMENT_LINKS_ACCESSED',
        entityType: 'GENERATED_DOCUMENT',
        entityId: documentId,
        result: 'SUCCESS',
        context: context_(options),
        metadata: {
          has_google_doc: !!result.google_doc_url,
          has_docx: !!result.docx_url,
          has_pdf: !!result.pdf_url
        }
      });
    }
    return result;
  }

  function voidDocument(documentId, expectedVersion, reason, options) {
    bootstrap_();
    options = options || {};
    assert_(expectedVersion !== null && expectedVersion !== undefined,
      'ROW_VERSION_REQUIRED',
      'Cần row_version để vô hiệu tài liệu.');
    var current = HrSheetStore.get(DOCUMENTS_, documentId);
    assert_(current && current.record_status !== 'DELETED', 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.');
    if (current.generation_status === 'VOIDED') return safeResult_(current);
    assert_(current.generation_status === 'GENERATED',
      'DOCUMENT_VOID_STATUS_INVALID',
      'Chỉ tài liệu GENERATED được vô hiệu.');
    var voidReason = trim_(reason);
    assert_(voidReason, 'DOCUMENT_VOID_REASON_REQUIRED', 'Vô hiệu tài liệu bắt buộc có lý do.');
    var context = context_(options);
    var updated = HrSheetStore.update(DOCUMENTS_, documentId, {
      generation_status: 'VOIDED',
      void_reason: voidReason
    }, expectedVersion, { context: context });
    audit_('DOCUMENT_VOIDED', current, updated, context);
    return safeResult_(updated);
  }

  return Object.freeze({
    generateProbationContract: generateProbationContract,
    list: list,
    listHistory: listHistory,
    get: get,
    getDownloadLinks: getDownloadLinks,
    voidDocument: voidDocument
  });
})();

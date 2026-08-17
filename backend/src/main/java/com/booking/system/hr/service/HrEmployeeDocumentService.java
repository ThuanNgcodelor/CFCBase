package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrEmployeeDocumentDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeDocument;
import com.booking.system.hr.enums.HrDocumentCategory;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeDocumentRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class HrEmployeeDocumentService {

    private static final long MAX_FILE_SIZE = 15 * 1024 * 1024L; // 15 MB
    private static final Pattern NON_FILE_NAME = Pattern.compile("[^a-zA-Z0-9._\\- ()]+");
    private static final byte[] PDF_MAGIC_BYTES = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D}; // %PDF-

    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeDocumentRepository documentRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;

    @Transactional
    public HrEmployeeDocumentDtos.DocumentSummary uploadDocument(
            String employeeId,
            HrEmployeeDocumentDtos.UploadRequest request,
            MultipartFile file,
            HrImportActor actor
    ) {
        HrEmployee employee = requireEmployee(employeeId);
        validateUploadRequest(request);
        byte[] fileBytes = validateAndExtractPdfFile(file);

        String originalFilename = file.getOriginalFilename();
        String sanitizedFilename = sanitizeFileName(originalFilename, request.documentName());
        String sha256 = calculateSha256(fileBytes);

        HrEmployeeDocument document = new HrEmployeeDocument();
        document.setEmployee(employee);
        document.setDocumentCategory(request.documentCategory());
        document.setDocumentName(request.documentName().trim());
        document.setFileName(sanitizedFilename);
        document.setFileType("application/pdf");
        document.setFileSizeBytes(fileBytes.length);
        document.setFileSha256(sha256);
        document.setFileData(fileBytes);
        document.setDocumentNumber(trimToNull(request.documentNumber()));
        document.setIssueDate(request.issueDate());
        document.setExpiryDate(request.expiryDate());
        document.setIssuingAuthority(trimToNull(request.issuingAuthority()));
        document.setNote(trimToNull(request.note()));
        setCreatedAudit(document, actor);

        document = documentRepository.save(document);

        audit(actor, "HR_EMPLOYEE_DOCUMENT_UPLOADED", document, List.of("file", "metadata"), Map.of(
                "employeeId", employee.getId(),
                "documentCategory", document.getDocumentCategory().name(),
                "documentName", document.getDocumentName(),
                "fileName", document.getFileName(),
                "fileSizeBytes", document.getFileSizeBytes(),
                "fileSha256", document.getFileSha256()
        ));

        return toSummary(document);
    }

    @Transactional
    public List<HrEmployeeDocumentDtos.DocumentSummary> uploadDocumentsBatch(
            String employeeId,
            List<MultipartFile> files,
            HrDocumentCategory defaultCategory,
            HrImportActor actor
    ) {
        HrEmployee employee = requireEmployee(employeeId);
        if (files == null || files.isEmpty()) {
            throw HrApiException.badRequest("FILES_REQUIRED", "Danh sách file đính kèm là bắt buộc.");
        }
        if (files.size() > 20) {
            throw HrApiException.badRequest("TOO_MANY_FILES", "Mỗi lần tải lên tối đa 20 file.");
        }

        HrDocumentCategory category = defaultCategory != null ? defaultCategory : HrDocumentCategory.OTHER;
        List<HrEmployeeDocumentDtos.DocumentSummary> results = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            byte[] fileBytes = validateAndExtractPdfFile(file);
            String originalFilename = file.getOriginalFilename();
            String fallbackName = originalFilename != null
                    ? originalFilename.replaceAll("(?i)\\.pdf$", "").replace('_', ' ').replace('-', ' ').trim()
                    : "Tài liệu";
            if (fallbackName.isBlank()) fallbackName = "Tài liệu";
            String sanitizedFilename = sanitizeFileName(originalFilename, fallbackName);
            String sha256 = calculateSha256(fileBytes);

            HrEmployeeDocument document = new HrEmployeeDocument();
            document.setEmployee(employee);
            document.setDocumentCategory(category);
            document.setDocumentName(fallbackName);
            document.setFileName(sanitizedFilename);
            document.setFileType("application/pdf");
            document.setFileSizeBytes(fileBytes.length);
            document.setFileSha256(sha256);
            document.setFileData(fileBytes);
            setCreatedAudit(document, actor);

            document = documentRepository.save(document);

            audit(actor, "HR_EMPLOYEE_DOCUMENT_UPLOADED", document, List.of("file", "metadata"), Map.of(
                    "employeeId", employee.getId(),
                    "documentCategory", document.getDocumentCategory().name(),
                    "documentName", document.getDocumentName(),
                    "fileName", document.getFileName(),
                    "fileSizeBytes", document.getFileSizeBytes(),
                    "fileSha256", document.getFileSha256(),
                    "batch", true
            ));

            results.add(toSummary(document));
        }

        if (results.isEmpty()) {
            throw HrApiException.badRequest("NO_VALID_FILES", "Không có file hợp lệ nào để tải lên.");
        }

        return results;
    }

    @Transactional(readOnly = true)
    public List<HrEmployeeDocumentDtos.DocumentSummary> getDocuments(
            String employeeId,
            HrDocumentCategory category
    ) {
        requireEmployee(employeeId);
        List<HrEmployeeDocument> list = category == null
                ? documentRepository.findAllByEmployeeId(employeeId)
                : documentRepository.findAllByEmployeeIdAndCategory(employeeId, category);

        return list.stream().map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public HrEmployeeDocumentDtos.DocumentSummary getDocument(String documentId) {
        HrEmployeeDocument document = requireDocument(documentId);
        return toSummary(document);
    }

    @Transactional(readOnly = true)
    public HrEmployeeDocumentDtos.DocumentFile getDocumentFile(String documentId) {
        HrEmployeeDocument document = requireDocument(documentId);
        return new HrEmployeeDocumentDtos.DocumentFile(
                document.getId(),
                document.getFileName(),
                document.getFileType(),
                document.getFileData()
        );
    }

    @Transactional
    public HrEmployeeDocumentDtos.DocumentSummary updateDocument(
            String documentId,
            HrEmployeeDocumentDtos.UpdateRequest request,
            HrImportActor actor
    ) {
        HrEmployeeDocument document = requireDocument(documentId);
        if (document.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("STALE_DOCUMENT_VERSION",
                    "Hồ sơ đã được chỉnh sửa ở nơi khác. Vui lòng tải lại trang.");
        }

        Map<String, Object> changes = new LinkedHashMap<>();
        if (document.getDocumentCategory() != request.documentCategory()) {
            changes.put("documentCategory", request.documentCategory().name());
            document.setDocumentCategory(request.documentCategory());
        }
        if (!Objects.equals(document.getDocumentName(), request.documentName().trim())) {
            changes.put("documentName", request.documentName().trim());
            document.setDocumentName(request.documentName().trim());
        }
        String newDocNumber = trimToNull(request.documentNumber());
        if (!Objects.equals(document.getDocumentNumber(), newDocNumber)) {
            changes.put("documentNumber", newDocNumber);
            document.setDocumentNumber(newDocNumber);
        }
        if (!Objects.equals(document.getIssueDate(), request.issueDate())) {
            changes.put("issueDate", request.issueDate());
            document.setIssueDate(request.issueDate());
        }
        if (!Objects.equals(document.getExpiryDate(), request.expiryDate())) {
            changes.put("expiryDate", request.expiryDate());
            document.setExpiryDate(request.expiryDate());
        }
        String newAuthority = trimToNull(request.issuingAuthority());
        if (!Objects.equals(document.getIssuingAuthority(), newAuthority)) {
            changes.put("issuingAuthority", newAuthority);
            document.setIssuingAuthority(newAuthority);
        }
        String newNote = trimToNull(request.note());
        if (!Objects.equals(document.getNote(), newNote)) {
            changes.put("note", newNote);
            document.setNote(newNote);
        }

        document.setUpdatedByActor(actor.subject());
        document = documentRepository.save(document);

        if (!changes.isEmpty()) {
            audit(actor, "HR_EMPLOYEE_DOCUMENT_UPDATED", document, changes.keySet().stream().toList(), changes);
        }

        return toSummary(document);
    }

    @Transactional
    public void deleteDocument(String documentId, long rowVersion, HrImportActor actor) {
        HrEmployeeDocument document = requireDocument(documentId);
        if (document.getRowVersion() != rowVersion) {
            throw HrApiException.conflict("STALE_DOCUMENT_VERSION",
                    "Hồ sơ đã được chỉnh sửa ở nơi khác. Vui lòng tải lại trang.");
        }

        audit(actor, "HR_EMPLOYEE_DOCUMENT_DELETED", document, List.of("deleted"), Map.of(
                "employeeId", document.getEmployee().getId(),
                "documentCategory", document.getDocumentCategory().name(),
                "documentName", document.getDocumentName(),
                "fileName", document.getFileName(),
                "fileSizeBytes", document.getFileSizeBytes()
        ));

        documentRepository.delete(document);
    }

    private HrEmployee requireEmployee(String employeeId) {
        return employeeRepository.findById(employeeId)
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND",
                        "Không tìm thấy hồ sơ nhân sự."));
    }

    private HrEmployeeDocument requireDocument(String documentId) {
        return documentRepository.findDetailById(documentId)
                .orElseThrow(() -> HrApiException.notFound("HR_DOCUMENT_NOT_FOUND",
                        "Không tìm thấy tài liệu hồ sơ nhân sự."));
    }

    private void validateUploadRequest(HrEmployeeDocumentDtos.UploadRequest request) {
        if (request == null) {
            throw HrApiException.badRequest("REQUEST_REQUIRED", "Thông tin tải lên là bắt buộc.");
        }
        if (request.documentCategory() == null) {
            throw HrApiException.badRequest("CATEGORY_REQUIRED", "Danh mục hồ sơ là bắt buộc.");
        }
        if (request.documentName() == null || request.documentName().isBlank()) {
            throw HrApiException.badRequest("DOCUMENT_NAME_REQUIRED", "Tên hồ sơ là bắt buộc.");
        }
        if (request.issueDate() != null && request.expiryDate() != null
                && request.expiryDate().isBefore(request.issueDate())) {
            throw HrApiException.badRequest("EXPIRY_BEFORE_ISSUE_DATE",
                    "Ngày hết hạn không được trước ngày cấp.");
        }
    }

    private byte[] validateAndExtractPdfFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw HrApiException.badRequest("FILE_REQUIRED", "File đính kèm là bắt buộc.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw HrApiException.badRequest("FILE_TOO_LARGE",
                    "Dung lượng file vượt quá giới hạn cho phép (tối đa 15MB).");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw HrApiException.badRequest("FILE_READ_ERROR", "Không thể đọc dữ liệu file tải lên.");
        }

        if (bytes.length < 5 || !isPdfHeader(bytes)) {
            throw HrApiException.badRequest("INVALID_PDF_FORMAT",
                    "File tải lên không phải là định dạng PDF hợp lệ.");
        }

        return bytes;
    }

    private static boolean isPdfHeader(byte[] bytes) {
        for (int i = 0; i < PDF_MAGIC_BYTES.length; i++) {
            if (bytes[i] != PDF_MAGIC_BYTES[i]) {
                return false;
            }
        }
        return true;
    }

    private static String sanitizeFileName(String originalFilename, String fallbackName) {
        String baseName = originalFilename == null || originalFilename.isBlank()
                ? fallbackName + ".pdf"
                : originalFilename.trim();

        String sanitized = NON_FILE_NAME.matcher(baseName).replaceAll("_").trim();
        if (!sanitized.toLowerCase().endsWith(".pdf")) {
            sanitized = sanitized + ".pdf";
        }
        return sanitized;
    }

    private static String calculateSha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 không khả dụng.", exception);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static void setCreatedAudit(HrEmployeeDocument document, HrImportActor actor) {
        document.setCreatedByActor(actor.subject());
        document.setUpdatedByActor(actor.subject());
    }

    private void audit(
            HrImportActor actor,
            String action,
            HrEmployeeDocument document,
            List<String> changedFields,
            Map<String, Object> metadata
    ) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType("HR_EMPLOYEE_DOCUMENT");
        event.setEntityId(document.getId());
        try {
            event.setChangedFields(jsonCodec.write(changedFields));
            event.setSanitizedMetadata(jsonCodec.write(metadata));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi audit nhật ký hồ sơ.", exception);
        }
        auditRepository.save(event);
    }

    private HrEmployeeDocumentDtos.DocumentSummary toSummary(HrEmployeeDocument document) {
        return new HrEmployeeDocumentDtos.DocumentSummary(
                document.getId(),
                document.getEmployee().getId(),
                document.getDocumentCategory(),
                document.getDocumentName(),
                document.getFileName(),
                document.getFileType(),
                document.getFileSizeBytes(),
                document.getFileSha256(),
                document.getDocumentNumber(),
                document.getIssueDate(),
                document.getExpiryDate(),
                document.getIssuingAuthority(),
                document.getNote(),
                document.getCreatedAt(),
                document.getCreatedByActor(),
                document.getUpdatedAt(),
                document.getUpdatedByActor(),
                document.getRowVersion()
        );
    }
}

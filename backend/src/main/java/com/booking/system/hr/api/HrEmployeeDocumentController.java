package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrEmployeeDocumentDtos;
import com.booking.system.hr.enums.HrDocumentCategory;
import com.booking.system.hr.service.HrEmployeeDocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/hr")
@RequiredArgsConstructor
public class HrEmployeeDocumentController {

    private final HrEmployeeDocumentService documentService;
    private final HrActorResolver actorResolver;

    @GetMapping("/employees/{employeeId}/documents")
    public ResponseEntity<ApiResponse<List<HrEmployeeDocumentDtos.DocumentSummary>>> getDocuments(
            @PathVariable String employeeId,
            @RequestParam(required = false) HrDocumentCategory category
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentService.getDocuments(employeeId, category),
                "Lấy danh sách hồ sơ nhân sự thành công"
        ));
    }

    @PostMapping(value = "/employees/{employeeId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrEmployeeDocumentDtos.DocumentSummary>> uploadDocument(
            @AuthenticationPrincipal User principal,
            @PathVariable String employeeId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("documentCategory") HrDocumentCategory documentCategory,
            @RequestParam("documentName") String documentName,
            @RequestParam(value = "documentNumber", required = false) String documentNumber,
            @RequestParam(value = "issueDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issueDate,
            @RequestParam(value = "expiryDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
            @RequestParam(value = "issuingAuthority", required = false) String issuingAuthority,
            @RequestParam(value = "note", required = false) String note
    ) {
        HrEmployeeDocumentDtos.UploadRequest request = new HrEmployeeDocumentDtos.UploadRequest(
                documentCategory,
                documentName,
                documentNumber,
                issueDate,
                expiryDate,
                issuingAuthority,
                note
        );

        HrEmployeeDocumentDtos.DocumentSummary result = documentService.uploadDocument(
                employeeId,
                request,
                file,
                actorResolver.fromPrincipal(principal)
        );

        return ResponseEntity.ok(ApiResponse.success(result, "Tải lên hồ sơ nhân sự thành công"));
    }

    @PostMapping(value = "/employees/{employeeId}/documents/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<List<HrEmployeeDocumentDtos.DocumentSummary>>> uploadDocumentsBatch(
            @AuthenticationPrincipal User principal,
            @PathVariable String employeeId,
            @RequestPart("files") List<MultipartFile> files,
            @RequestParam(value = "documentCategory", required = false) HrDocumentCategory documentCategory
    ) {
        List<HrEmployeeDocumentDtos.DocumentSummary> results = documentService.uploadDocumentsBatch(
                employeeId,
                files,
                documentCategory,
                actorResolver.fromPrincipal(principal)
        );
        return ResponseEntity.ok(ApiResponse.success(results, "Tải lên danh sách hồ sơ nhân sự thành công"));
    }

    @GetMapping("/employee-documents/{documentId}")
    public ResponseEntity<ApiResponse<HrEmployeeDocumentDtos.DocumentSummary>> getDocument(
            @PathVariable String documentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentService.getDocument(documentId),
                "Lấy thông tin hồ sơ nhân sự thành công"
        ));
    }

    @GetMapping("/employee-documents/{documentId}/view")
    public ResponseEntity<byte[]> viewDocumentInline(@PathVariable String documentId) {
        HrEmployeeDocumentDtos.DocumentFile file = documentService.getDocumentFile(documentId);
        MediaType mediaType;
        try {
            mediaType = file.fileType() != null ? MediaType.parseMediaType(file.fileType()) : MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(file.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(file.bytes());
    }

    @GetMapping("/employee-documents/{documentId}/download")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable String documentId) {
        HrEmployeeDocumentDtos.DocumentFile file = documentService.getDocumentFile(documentId);
        MediaType mediaType;
        try {
            mediaType = file.fileType() != null ? MediaType.parseMediaType(file.fileType()) : MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(file.bytes());
    }

    @PatchMapping("/employee-documents/{documentId}")
    public ResponseEntity<ApiResponse<HrEmployeeDocumentDtos.DocumentSummary>> updateDocument(
            @AuthenticationPrincipal User principal,
            @PathVariable String documentId,
            @Valid @RequestBody HrEmployeeDocumentDtos.UpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentService.updateDocument(
                        documentId,
                        request,
                        actorResolver.fromPrincipal(principal)
                ),
                "Cập nhật thông tin hồ sơ thành công"
        ));
    }

    @DeleteMapping("/employee-documents/{documentId}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(
            @AuthenticationPrincipal User principal,
            @PathVariable String documentId,
            @RequestParam long rowVersion
    ) {
        documentService.deleteDocument(
                documentId,
                rowVersion,
                actorResolver.fromPrincipal(principal)
        );
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa hồ sơ nhân sự"));
    }
}

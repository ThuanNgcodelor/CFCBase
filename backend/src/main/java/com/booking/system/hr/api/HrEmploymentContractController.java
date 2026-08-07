package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrEmploymentContractDtos;
import com.booking.system.hr.service.HrEmploymentContractDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/hr")
@RequiredArgsConstructor
public class HrEmploymentContractController {

    private static final MediaType DOCX_MEDIA_TYPE = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final HrEmploymentContractDocumentService documentService;
    private final HrActorResolver actorResolver;

    @PostMapping("/employment-contracts/{contractId}/documents")
    public ResponseEntity<ApiResponse<HrEmploymentContractDtos.DocumentSummary>> generateDocument(
            @AuthenticationPrincipal User principal,
            @PathVariable String contractId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentService.generate(contractId, actorResolver.fromPrincipal(principal)),
                "Tạo file hợp đồng lao động thành công"
        ));
    }

    @GetMapping("/employment-contract-documents/{documentId}/download")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable String documentId) {
        HrEmploymentContractDtos.DocumentFile file = documentService.download(documentId);
        return ResponseEntity.ok()
                .contentType(DOCX_MEDIA_TYPE)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(file.bytes());
    }
}

package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrImportBatchResponse;
import com.booking.system.hr.api.dto.HrImportConfirmRequest;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.importer.HrBaselineImportService;
import com.booking.system.hr.importer.HrImportBatchSummary;
import com.booking.system.hr.importer.HrImportPreviewPage;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/hr/imports")
public class HrImportController {

    private final HrActivityQueryService queryService;
    private final HrBaselineImportService importService;
    private final HrActorResolver actorResolver;

    public HrImportController(
            HrActivityQueryService queryService,
            HrBaselineImportService importService,
            HrActorResolver actorResolver
    ) {
        this.queryService = queryService;
        this.importService = importService;
        this.actorResolver = actorResolver;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<HrPageResponse<HrImportBatchResponse>>> imports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.imports(page, size),
                "Lấy lịch sử import HR thành công"
        ));
    }

    @PostMapping(value = "/baseline", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrImportBatchSummary>> uploadBaseline(
            @AuthenticationPrincipal User principal,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File baseline là bắt buộc.");
        }
        HrImportBatchSummary result = importService.uploadAndParse(
                file.getOriginalFilename(),
                file.getBytes(),
                actorResolver.fromPrincipal(principal)
        );
        return ResponseEntity.ok(ApiResponse.success(result, "Đã tải và phân tích baseline HR"));
    }

    @GetMapping("/{batchId}/preview")
    public ResponseEntity<ApiResponse<HrImportPreviewPage>> preview(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = size <= 0
                ? HrActivityQueryService.DEFAULT_PAGE_SIZE
                : Math.min(size, HrActivityQueryService.MAX_PAGE_SIZE);
        return ResponseEntity.ok(ApiResponse.success(
                importService.preview(batchId, safePage, safeSize),
                "Lấy dữ liệu xem trước import thành công"
        ));
    }

    @PostMapping("/{batchId}/validate")
    public ResponseEntity<ApiResponse<HrImportBatchSummary>> validate(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                importService.validate(batchId, actorResolver.fromPrincipal(principal)),
                "Đã kiểm tra batch import HR"
        ));
    }

    @PostMapping("/{batchId}/confirm")
    public ResponseEntity<ApiResponse<HrImportBatchSummary>> confirm(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId,
            @Valid @RequestBody HrImportConfirmRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                importService.confirm(
                        batchId,
                        request.confirmationKey(),
                        request.acceptWarnings(),
                        actorResolver.fromPrincipal(principal)
                ),
                "Đã xác nhận import baseline HR"
        ));
    }

    @PostMapping("/{batchId}/rollback")
    public ResponseEntity<ApiResponse<HrImportBatchSummary>> rollback(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                importService.rollback(batchId, actorResolver.fromPrincipal(principal)),
                "Đã rollback batch import HR"
        ));
    }
}

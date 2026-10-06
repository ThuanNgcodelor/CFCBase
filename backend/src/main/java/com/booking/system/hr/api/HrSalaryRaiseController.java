package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.*;
import com.booking.system.hr.service.HrSalaryRaiseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/hr/salary-raises")
@RequiredArgsConstructor
public class HrSalaryRaiseController {
    private final HrSalaryRaiseService service;
    private final HrActorResolver actorResolver;

    @GetMapping("/imports")
    public ApiResponse<HrPageResponse<HrSalaryRaiseDtos.BatchResponse>> imports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.imports(page, size), "Lịch sử import nâng lương");
    }

    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<HrSalaryRaiseDtos.BatchResponse> upload(
            @AuthenticationPrincipal User principal,
            @RequestPart("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw HrApiException.badRequest("SALARY_RAISE_FILE_EMPTY", "File nâng lương là bắt buộc.");
        }
        return ApiResponse.success(service.upload(file.getOriginalFilename(), file.getBytes(),
                actorResolver.fromPrincipal(principal)), "Đã tải và phân tích file nâng lương");
    }

    @GetMapping("/imports/{batchId}/preview")
    public ApiResponse<HrSalaryRaiseDtos.PreviewResponse> preview(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.preview(batchId, page, size), "Dữ liệu xem trước nâng lương");
    }

    @PostMapping("/imports/{batchId}/validate")
    public ApiResponse<HrSalaryRaiseDtos.BatchResponse> validate(
            @AuthenticationPrincipal User principal, @PathVariable String batchId) {
        return ApiResponse.success(service.validate(batchId, actorResolver.fromPrincipal(principal)),
                "Đã kiểm tra batch nâng lương");
    }

    @PostMapping("/imports/{batchId}/confirm")
    public ApiResponse<HrSalaryRaiseDtos.BatchResponse> confirm(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId,
            @Valid @RequestBody HrImportConfirmRequest request) {
        return ApiResponse.success(service.confirm(batchId, request.confirmationKey(), request.acceptWarnings(),
                actorResolver.fromPrincipal(principal)), "Đã xác nhận nâng lương");
    }

    @PostMapping("/imports/{batchId}/rollback")
    public ApiResponse<HrSalaryRaiseDtos.BatchResponse> rollback(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId,
            @Valid @RequestBody HrSalaryRaiseDtos.RollbackRequest request) {
        return ApiResponse.success(service.rollback(batchId, request.reason(), actorResolver.fromPrincipal(principal)),
                "Đã rollback batch nâng lương");
    }

    @DeleteMapping("/imports/{batchId}")
    public ApiResponse<Void> deleteImport(
            @AuthenticationPrincipal User principal,
            @PathVariable String batchId) {
        service.deleteImport(batchId, actorResolver.fromPrincipal(principal));
        return ApiResponse.success(null, "Đã xóa file import; lịch sử lương đã áp dụng vẫn được giữ lại");
    }
}

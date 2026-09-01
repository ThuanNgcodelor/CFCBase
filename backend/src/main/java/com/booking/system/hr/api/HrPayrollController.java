package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrPayrollDtos;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrPayrollCampaignService;
import com.booking.system.hr.service.HrPayrollService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/hr/payroll")
@RequiredArgsConstructor
public class HrPayrollController {
    private final HrPayrollService payrollService;
    private final HrPayrollCampaignService campaignService;
    private final HrActorResolver actorResolver;

    @GetMapping("/imports")
    public ResponseEntity<ApiResponse<HrPageResponse<HrPayrollDtos.ImportResponse>>> imports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(payrollService.imports(page, size), "Lấy danh sách file lương thành công"));
    }

    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrPayrollDtos.ImportResponse>> upload(
            @AuthenticationPrincipal User principal,
            @RequestPart("file") MultipartFile file) throws java.io.IOException {
        if (file == null || file.isEmpty()) {
            throw HrApiException.badRequest("PAYROLL_FILE_EMPTY", "Vui lòng chọn file Excel lương.");
        }
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(
                payrollService.upload(file.getOriginalFilename(), file.getBytes(), actor),
                "Đã đọc file lương, vui lòng kiểm tra bản xem trước"));
    }

    @GetMapping("/imports/{importId}/preview")
    public ResponseEntity<ApiResponse<HrPayrollDtos.PreviewResponse>> preview(
            @PathVariable String importId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(payrollService.preview(importId, page, size), "Lấy bản xem trước file lương thành công"));
    }

    @PostMapping("/imports/{importId}/campaigns")
    public ResponseEntity<ApiResponse<HrPayrollDtos.CampaignResponse>> createCampaign(
            @AuthenticationPrincipal User principal,
            @PathVariable String importId,
            @Valid @RequestBody(required = false) HrPayrollDtos.CreateCampaignRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                campaignService.create(importId, request, actorResolver.fromPrincipal(principal)),
                "Đã tạo hàng đợi gửi phiếu lương"));
    }

    @GetMapping("/campaigns/{campaignId}")
    public ResponseEntity<ApiResponse<HrPayrollDtos.CampaignResponse>> campaign(@PathVariable String campaignId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.campaign(campaignId), "Lấy trạng thái gửi lương thành công"));
    }

    @PostMapping("/campaigns/{campaignId}/start")
    public ResponseEntity<ApiResponse<HrPayrollDtos.CampaignResponse>> start(
            @AuthenticationPrincipal User principal,
            @PathVariable String campaignId) {
        HrPayrollDtos.CampaignResponse response = campaignService.start(campaignId, actorResolver.fromPrincipal(principal));
        campaignService.processAsync(campaignId);
        return ResponseEntity.accepted().body(ApiResponse.success(response, "Đã bắt đầu gửi phiếu lương qua Telegram"));
    }

    @GetMapping("/campaigns/{campaignId}/deliveries")
    public ResponseEntity<ApiResponse<HrPageResponse<HrPayrollDtos.PayrollDeliveryResponse>>> deliveries(
            @PathVariable String campaignId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.deliveries(campaignId, page, size), "Lấy kết quả gửi lương thành công"));
    }

    @PostMapping("/campaigns/{campaignId}/retry")
    public ResponseEntity<ApiResponse<HrPayrollDtos.CampaignResponse>> retry(
            @AuthenticationPrincipal User principal,
            @PathVariable String campaignId) {
        HrPayrollDtos.CampaignResponse response = campaignService.retryFailed(campaignId, actorResolver.fromPrincipal(principal));
        campaignService.processAsync(campaignId);
        return ResponseEntity.accepted().body(ApiResponse.success(response, "Đã xếp lại các dòng lỗi để gửi lại"));
    }
}

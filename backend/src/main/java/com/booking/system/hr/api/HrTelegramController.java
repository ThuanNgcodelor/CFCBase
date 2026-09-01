package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrTelegramDtos;
import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrTelegramExcelExportService;
import com.booking.system.hr.service.HrTelegramService;
import com.booking.system.hr.service.TelegramBotClient;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.function.Function;

@RestController
@RequestMapping("/api/v1/hr/telegram")
public class HrTelegramController {

    private final HrTelegramService service;
    private final HrTelegramExcelExportService exportService;
    private final TelegramBotClient botClient;
    private final HrActorResolver actorResolver;

    public HrTelegramController(HrTelegramService service, HrTelegramExcelExportService exportService,
                                TelegramBotClient botClient, HrActorResolver actorResolver) {
        this.service = service;
        this.exportService = exportService;
        this.botClient = botClient;
        this.actorResolver = actorResolver;
    }

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<HrTelegramDtos.SettingsResponse>> settings() {
        return ResponseEntity.ok(ApiResponse.success(service.settings(), "Lấy cấu hình Telegram thành công"));
    }

    @PutMapping("/settings")
    public ResponseEntity<ApiResponse<HrTelegramDtos.SettingsResponse>> updateSettings(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrTelegramDtos.SettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                service.updateSettings(request, actorResolver.fromPrincipal(principal)),
                "Cập nhật cấu hình Telegram thành công"));
    }

    @PostMapping("/test-connection")
    public ResponseEntity<ApiResponse<HrTelegramDtos.WebhookResult>> testConnection() {
        return ResponseEntity.ok(ApiResponse.success(
                new HrTelegramDtos.WebhookResult(botClient.testConnection() ? "OK" : "NOT_CONFIGURED_OR_UNREACHABLE"),
                "Đã kiểm tra kết nối bot Telegram"));
    }

    @GetMapping("/common-link")
    public ResponseEntity<ApiResponse<String>> commonLink() {
        return ResponseEntity.ok(ApiResponse.success(service.commonBotLink(), "Lấy liên kết bot Telegram thành công"));
    }

    @GetMapping("/registrations")
    public ResponseEntity<ApiResponse<HrPageResponse<HrTelegramDtos.RegistrationResponse>>> registrations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) HrTelegramRegistrationStatus status) {
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.success(
                HrPageResponse.from(service.registrations(keyword, status, pageable), Function.identity()),
                "Lấy danh sách đăng ký Telegram thành công"));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<HrTelegramDtos.SummaryResponse>> summary() {
        return ResponseEntity.ok(ApiResponse.success(service.summary(), "Lấy tổng hợp đăng ký Telegram thành công"));
    }

    @PostMapping("/registrations/{registrationId}/verify")
    public ResponseEntity<ApiResponse<HrTelegramDtos.RegistrationResponse>> verify(
            @AuthenticationPrincipal User principal,
            @PathVariable String registrationId,
            @Valid @RequestBody(required = false) HrTelegramDtos.ReviewRequest request) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.verify(registrationId, request, actor), "Đã xác minh đăng ký Telegram"));
    }

    @PostMapping("/registrations/{registrationId}/reject")
    public ResponseEntity<ApiResponse<HrTelegramDtos.RegistrationResponse>> reject(
            @AuthenticationPrincipal User principal,
            @PathVariable String registrationId,
            @Valid @RequestBody(required = false) HrTelegramDtos.ReviewRequest request) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.reject(registrationId, request, actor), "Đã từ chối đăng ký Telegram"));
    }

    @PostMapping("/employees/{employeeId}/revoke")
    public ResponseEntity<ApiResponse<Void>> revoke(
            @AuthenticationPrincipal User principal,
            @PathVariable String employeeId,
            @Valid @RequestBody(required = false) HrTelegramDtos.ReviewRequest request) {
        service.revoke(employeeId, request, actorResolver.fromPrincipal(principal));
        return ResponseEntity.ok(ApiResponse.success(null, "Đã thu hồi liên kết Telegram"));
    }

    @GetMapping("/registrations/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) HrTelegramRegistrationStatus status) {
        HrTelegramExcelExportService.ExportFile file = exportService.export(status);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName()).build().toString())
                .body(file.content());
    }
}

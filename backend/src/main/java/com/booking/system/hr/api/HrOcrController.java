package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrOcrProfileResult;
import com.booking.system.hr.api.dto.HrOcrSettingsDto;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrOcrService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hr/ocr")
public class HrOcrController {

    private final HrOcrService ocrService;
    private final HrActorResolver actorResolver;

    public HrOcrController(HrOcrService ocrService, HrActorResolver actorResolver) {
        this.ocrService = ocrService;
        this.actorResolver = actorResolver;
    }

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<HrOcrSettingsDto>> getSettings(
            @AuthenticationPrincipal User principal
    ) {
        actorResolver.fromPrincipal(principal);
        HrOcrSettingsDto settings = ocrService.getSettings();
        return ResponseEntity.ok(ApiResponse.success(settings, "Lấy cấu hình OCR thành công"));
    }

    @PostMapping("/settings")
    public ResponseEntity<ApiResponse<HrOcrSettingsDto>> updateSettings(
            @AuthenticationPrincipal User principal,
            @RequestBody HrOcrSettingsDto request
    ) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        HrOcrSettingsDto updated = ocrService.updateSettings(request, actor);
        return ResponseEntity.ok(ApiResponse.success(updated, "Cập nhật cấu hình OCR thành công"));
    }

    @PostMapping(value = "/extract-profile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrOcrProfileResult>> extractProfile(
            @AuthenticationPrincipal User principal,
            @RequestParam("files") List<MultipartFile> files
    ) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        HrOcrProfileResult result = ocrService.extractProfile(files, actor);
        return ResponseEntity.ok(ApiResponse.success(result, "Trích xuất thông tin hồ sơ thành công"));
    }
}

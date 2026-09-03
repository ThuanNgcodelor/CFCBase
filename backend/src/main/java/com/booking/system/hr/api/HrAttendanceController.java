package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrAttendanceDtos;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrAttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/hr/attendance")
public class HrAttendanceController {
    private final HrAttendanceService attendanceService;
    private final HrActorResolver actorResolver;

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<HrAttendanceDtos.Config>> settings(@AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getConfig(), "Lấy cấu hình chấm công thành công"));
    }

    @PutMapping("/settings")
    public ResponseEntity<ApiResponse<HrAttendanceDtos.Config>> updateSettings(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrAttendanceDtos.Config request) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(attendanceService.updateConfig(request, actor), "Đã lưu cấu hình file chấm công"));
    }

    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrAttendanceDtos.ImportResponse>> upload(
            @AuthenticationPrincipal User principal,
            @RequestPart("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw HrApiException.badRequest("ATTENDANCE_FILE_EMPTY", "Vui lòng chọn file Excel chấm công.");
        return ResponseEntity.ok(ApiResponse.success(attendanceService.upload(file.getOriginalFilename(), file.getBytes(), actorResolver.fromPrincipal(principal)), "Đã đọc file chấm công, vui lòng kiểm tra xem trước"));
    }

    @GetMapping("/imports")
    public ResponseEntity<ApiResponse<com.booking.system.hr.api.dto.HrPageResponse<HrAttendanceDtos.ImportResponse>>> imports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(attendanceService.imports(page, size), "Lấy danh sách file chấm công thành công"));
    }

    @GetMapping("/imports/{importId}/preview")
    public ResponseEntity<ApiResponse<HrAttendanceDtos.PreviewResponse>> preview(
            @PathVariable String importId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(attendanceService.preview(importId, page, size), "Lấy bản xem trước chấm công thành công"));
    }
}

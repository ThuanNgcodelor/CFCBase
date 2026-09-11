package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrProductionAttendanceDtos;
import com.booking.system.hr.enums.HrProductionAttendanceShiftStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrProductionAttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/hr/attendance/production")
public class HrProductionAttendanceController {
    private final HrProductionAttendanceService service;
    private final HrActorResolver actorResolver;

    @GetMapping("/shift-policies")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.ShiftPolicyResponse>>> shiftPolicies(
            @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.shiftPolicies(), "Lấy cấu hình ca sản xuất thành công"));
    }

    @PutMapping("/shift-policies/{id}")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ShiftPolicyResponse>> updateShiftPolicy(
            @PathVariable String id, @Valid @RequestBody HrProductionAttendanceDtos.UpdateShiftPolicyRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.updateShiftPolicy(id, request, actor(principal)), "Đã cập nhật cấu hình ca"));
    }

    @GetMapping("/employee-policies")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.EmployeePolicyResponse>>> employeePolicies(
            @RequestParam String employeeCode, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.employeePolicies(employeeCode), "Lấy chính sách nhân viên thành công"));
    }

    @PostMapping("/employee-policies")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.EmployeePolicyResponse>> createEmployeePolicy(
            @Valid @RequestBody HrProductionAttendanceDtos.CreateEmployeePolicyRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.createEmployeePolicy(request, actor(principal)), "Đã gán chính sách chấm công"));
    }

    @GetMapping("/exemptions")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.ExemptionResponse>>> exemptions(
            @RequestParam String employeeCode, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.exemptions(employeeCode), "Lấy miễn chấm thành công"));
    }

    @PostMapping("/exemptions")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ExemptionResponse>> createExemption(
            @Valid @RequestBody HrProductionAttendanceDtos.CreateExemptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.createExemption(request, actor(principal)), "Đã tạo miễn chấm"));
    }

    @PostMapping("/exemptions/{id}/cancel")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ExemptionResponse>> cancelExemption(
            @PathVariable String id, @Valid @RequestBody HrProductionAttendanceDtos.CancelExemptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.cancelExemption(id, request, actor(principal)), "Đã hủy miễn chấm"));
    }

    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ImportResponse>> upload(
            @RequestParam(required = false) String month, @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal User principal) throws IOException {
        if (file == null || file.isEmpty()) throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_FILE_EMPTY", "Vui lòng chọn file Excel.");
        return ResponseEntity.ok(ApiResponse.success(service.upload(file.getOriginalFilename(), file.getBytes(), month, actor(principal)),
                "Đã import và phân tích ca sản xuất"));
    }

    @GetMapping("/imports")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProductionAttendanceDtos.ImportResponse>>> imports(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String month, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.imports(page, size, month), "Lấy lịch sử import thành công"));
    }

    @PostMapping("/imports/{id}/recalculate")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ImportResponse>> recalculate(
            @PathVariable String id, @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.recalculate(id, actor(principal)), "Đã tính lại từ dấu chấm gốc"));
    }

    @PostMapping("/imports/{id}/confirm")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ImportResponse>> confirmImport(
            @PathVariable String id, @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.confirmImport(id, actor(principal)), "Đã chốt đợt chấm công"));
    }

    @GetMapping("/imports/{id}/punches")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProductionAttendanceDtos.PunchResponse>>> punches(
            @PathVariable String id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.punches(id, page, size), "Lấy dấu chấm gốc thành công"));
    }

    @GetMapping("/shifts")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProductionAttendanceDtos.ShiftResponse>>> shifts(
            @RequestParam String importId, @RequestParam(required = false) HrProductionAttendanceShiftStatus status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "100") int size,
            @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.shifts(importId, status, page, size), "Lấy kết quả ghép ca thành công"));
    }

    @PutMapping("/shifts/{id}/decision")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.ShiftResponse>> decideShift(
            @PathVariable String id, @Valid @RequestBody HrProductionAttendanceDtos.ShiftDecisionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.decideShift(id, request, actor(principal)), "Đã lưu quyết định ca"));
    }

    @GetMapping("/shifts/{id}/adjustments")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.ShiftAdjustmentResponse>>> shiftAdjustments(
            @PathVariable String id, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.shiftAdjustments(id), "Lấy lịch sử điều chỉnh ca thành công"));
    }

    @PostMapping("/shifts/bulk-confirm")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.ShiftResponse>>> bulkConfirm(
            @Valid @RequestBody HrProductionAttendanceDtos.BulkConfirmRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.bulkConfirm(request, actor(principal)), "Đã xác nhận các ca tự ghép"));
    }

    @GetMapping("/incidents")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProductionAttendanceDtos.IncidentResponse>>> incidents(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.incidents(page, size), "Lấy danh sách sự cố máy thành công"));
    }

    @PostMapping("/incidents")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.IncidentResponse>> createIncident(
            @Valid @RequestBody HrProductionAttendanceDtos.CreateIncidentRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.createIncident(request, actor(principal)), "Đã tạo bản nháp sự cố máy"));
    }

    @PostMapping("/incidents/{id}/analyze")
    public ResponseEntity<ApiResponse<List<HrProductionAttendanceDtos.IncidentCandidate>>> analyzeIncident(
            @PathVariable String id, @RequestParam String importId, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.analyzeIncident(id, importId), "Đã phân tích ca bị ảnh hưởng"));
    }

    @PostMapping("/incidents/{id}/confirm")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.IncidentResponse>> confirmIncident(
            @PathVariable String id, @RequestParam String importId,
            @Valid @RequestBody HrProductionAttendanceDtos.ConfirmIncidentRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.confirmIncident(id, importId, request, actor(principal)), "Đã xác nhận sự cố và các ca được chọn"));
    }

    @PostMapping("/incidents/{id}/cancel")
    public ResponseEntity<ApiResponse<HrProductionAttendanceDtos.IncidentResponse>> cancelIncident(
            @PathVariable String id, @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.cancelIncident(id, actor(principal)), "Đã hủy bản nháp sự cố"));
    }

    private HrImportActor actor(User principal) { return actorResolver.fromPrincipal(principal); }
}

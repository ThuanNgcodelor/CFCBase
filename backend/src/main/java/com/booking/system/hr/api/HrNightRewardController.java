package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrNightRewardDtos;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.service.HrNightRewardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.hr.attendance.production", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequestMapping("/api/v1/hr/attendance/night-rewards")
public class HrNightRewardController {
    private final HrNightRewardService service;
    private final HrActorResolver actorResolver;

    @GetMapping("/months/{month}")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.MonthResponse>> preview(
            @PathVariable String month, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.preview(month), "Đã đối soát thưởng ca đêm theo tháng"));
    }

    @PostMapping("/months/{month}/finalize")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.FinalizeMonthResponse>> finalizeMonth(
            @PathVariable String month, @Valid @RequestBody HrNightRewardDtos.FinalizeMonthRequest request,
            @AuthenticationPrincipal User principal) {
        HrImportActor actor = actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.finalizeMonth(month, request, actor), "Đã chốt thưởng ca đêm theo tháng"));
    }

    @GetMapping("/exceptions")
    public ResponseEntity<ApiResponse<List<HrNightRewardDtos.ExceptionResponse>>> exceptions(
            @RequestParam String month, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.exceptions(month), "Đã lấy danh sách ngoại lệ thưởng ca đêm"));
    }

    @PostMapping("/exceptions")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.ExceptionResponse>> createException(
            @Valid @RequestBody HrNightRewardDtos.CreateExceptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.createException(request, actorResolver.fromPrincipal(principal)),
                "Đã tạo đề nghị ngoại lệ thưởng ca đêm"));
    }

    @PostMapping("/exceptions/{id}/approve")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.ExceptionResponse>> approveException(
            @PathVariable String id, @Valid @RequestBody HrNightRewardDtos.ReviewExceptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.approveException(id, request, actorResolver.fromPrincipal(principal)),
                "Đã duyệt ngoại lệ thưởng ca đêm"));
    }

    @PostMapping("/exceptions/{id}/reject")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.ExceptionResponse>> rejectException(
            @PathVariable String id, @Valid @RequestBody HrNightRewardDtos.ReviewExceptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.rejectException(id, request, actorResolver.fromPrincipal(principal)),
                "Đã từ chối ngoại lệ thưởng ca đêm"));
    }

    @PostMapping("/exceptions/{id}/cancel")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.ExceptionResponse>> cancelException(
            @PathVariable String id, @Valid @RequestBody HrNightRewardDtos.ReviewExceptionRequest request,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(ApiResponse.success(service.cancelException(id, request, actorResolver.fromPrincipal(principal)),
                "Đã hủy ngoại lệ thưởng ca đêm"));
    }

    @GetMapping("/employees/{employeeCode}/timeline")
    public ResponseEntity<ApiResponse<HrNightRewardDtos.EmployeeTimelineResponse>> timeline(
            @PathVariable String employeeCode, @AuthenticationPrincipal User principal) {
        actorResolver.fromPrincipal(principal);
        return ResponseEntity.ok(ApiResponse.success(service.employeeTimeline(employeeCode), "Đã lấy lịch sử thưởng ca đêm"));
    }
}

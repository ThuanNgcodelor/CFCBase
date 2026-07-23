package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrMovementCreateRequest;
import com.booking.system.hr.api.dto.HrMovementResponse;
import com.booking.system.hr.api.dto.HrRosterCreateRequest;
import com.booking.system.hr.api.dto.HrRosterReopenRequest;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.api.dto.HrVersionRequest;
import com.booking.system.hr.service.HrWorkforceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hr")
public class HrWorkforceController {

    private final HrWorkforceService workforceService;
    private final HrActorResolver actorResolver;

    public HrWorkforceController(HrWorkforceService workforceService, HrActorResolver actorResolver) {
        this.workforceService = workforceService;
        this.actorResolver = actorResolver;
    }

    @PostMapping("/movements")
    public ResponseEntity<ApiResponse<HrMovementResponse>> createMovement(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrMovementCreateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.createMovement(request, actorResolver.fromPrincipal(principal)),
                "Tạo biến động nhân sự nháp thành công"));
    }

    @PostMapping("/movements/{movementId}/confirm")
    public ResponseEntity<ApiResponse<HrMovementResponse>> confirmMovement(
            @AuthenticationPrincipal User principal,
            @PathVariable String movementId,
            @Valid @RequestBody HrVersionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.confirmMovement(
                        movementId, request.rowVersion(), actorResolver.fromPrincipal(principal)),
                "Xác nhận biến động nhân sự thành công"));
    }

    @PostMapping("/movements/{movementId}/cancel")
    public ResponseEntity<ApiResponse<HrMovementResponse>> cancelMovement(
            @AuthenticationPrincipal User principal,
            @PathVariable String movementId,
            @Valid @RequestBody HrVersionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.cancelMovement(
                        movementId, request.rowVersion(), actorResolver.fromPrincipal(principal)),
                "Hủy biến động nhân sự nháp thành công"));
    }

    @DeleteMapping("/movements/{movementId}")
    public ResponseEntity<ApiResponse<Void>> deleteMovement(
            @AuthenticationPrincipal User principal,
            @PathVariable String movementId,
            @RequestParam long rowVersion
    ) {
        workforceService.deleteDraftMovement(
                movementId, rowVersion, actorResolver.fromPrincipal(principal));
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa biến động nháp thành công"));
    }

    @DeleteMapping("/employees/{employeeId}")
    public ResponseEntity<ApiResponse<Void>> deleteDraftEmployee(
            @AuthenticationPrincipal User principal,
            @PathVariable String employeeId,
            @RequestParam long rowVersion
    ) {
        workforceService.deleteDraftEmployee(
                employeeId, rowVersion, actorResolver.fromPrincipal(principal));
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa hồ sơ nhân sự nháp thành công"));
    }

    @PostMapping("/rosters")
    public ResponseEntity<ApiResponse<HrRosterResponse>> createRoster(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrRosterCreateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.createRoster(request.periodStart(), actorResolver.fromPrincipal(principal)),
                "Tạo danh sách nhân sự tháng thành công"));
    }

    @PostMapping("/rosters/{rosterId}/open")
    public ResponseEntity<ApiResponse<HrRosterResponse>> openRoster(
            @AuthenticationPrincipal User principal,
            @PathVariable String rosterId,
            @Valid @RequestBody HrVersionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.openRoster(
                        rosterId, request.rowVersion(), actorResolver.fromPrincipal(principal)),
                "Mở danh sách nhân sự tháng thành công"));
    }

    @PostMapping("/rosters/{rosterId}/close")
    public ResponseEntity<ApiResponse<HrRosterResponse>> closeRoster(
            @AuthenticationPrincipal User principal,
            @PathVariable String rosterId,
            @Valid @RequestBody HrVersionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.closeRoster(
                        rosterId, request.rowVersion(), actorResolver.fromPrincipal(principal)),
                "Chốt danh sách nhân sự tháng thành công"));
    }

    @PostMapping("/rosters/{rosterId}/reopen")
    public ResponseEntity<ApiResponse<HrRosterResponse>> reopenRoster(
            @AuthenticationPrincipal User principal,
            @PathVariable String rosterId,
            @Valid @RequestBody HrRosterReopenRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.reopenRoster(
                        rosterId,
                        request.rowVersion(),
                        request.reason(),
                        actorResolver.fromPrincipal(principal)),
                "Mở lại danh sách nhân sự tháng thành công"));
    }

    @DeleteMapping("/rosters/{rosterId}")
    public ResponseEntity<ApiResponse<Void>> deleteRoster(
            @AuthenticationPrincipal User principal,
            @PathVariable String rosterId,
            @RequestParam long rowVersion
    ) {
        workforceService.deleteDraftRoster(
                rosterId, rowVersion, actorResolver.fromPrincipal(principal));
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa danh sách tháng nháp thành công"));
    }
}

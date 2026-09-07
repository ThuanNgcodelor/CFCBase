package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.hr.api.dto.*;
import com.booking.system.hr.dto.HrApiDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hr/employees/{employeeId}")
@RequiredArgsConstructor
public class HrEmployeeProfileController {
    private final HrEmployeeProfileQueryService service;

    @GetMapping("/movements")
    public ApiResponse<HrPageResponse<HrMovementResponse>> movements(@PathVariable String employeeId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.movements(employeeId, page, size), "Lịch sử biến động nhân sự");
    }

    @GetMapping("/profile-audit")
    public ApiResponse<HrPageResponse<HrAuditEventResponse>> audit(@PathVariable String employeeId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.profileAudit(employeeId, page, size), "Nhật ký hồ sơ nhân sự");
    }

    @GetMapping("/contracts")
    public ApiResponse<HrPageResponse<HrApiDtos.EmploymentContractSummary>> contracts(@PathVariable String employeeId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.contracts(employeeId, page, size), "Lịch sử hợp đồng nhân sự");
    }

    @GetMapping("/contracts/{contractId}/documents")
    public ApiResponse<HrPageResponse<HrEmploymentContractDtos.DocumentSummary>> documents(
            @PathVariable String employeeId, @PathVariable String contractId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.documents(employeeId, contractId, page, size), "Các bản hợp đồng đã xuất");
    }
}

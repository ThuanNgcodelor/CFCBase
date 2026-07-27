package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrMonthlyRosterItem;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrRosterInclusionReason;
import com.booking.system.hr.service.HrRosterProjectionService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record HrRosterItemResponse(
        String id,
        String employeeId,
        int displayOrder,
        Integer departmentDisplayOrder,
        String employeeCode,
        String fullName,
        String departmentCode,
        String departmentName,
        String positionCode,
        String positionName,
        String workingConditionCode,
        String workingConditionName,
        HrEmploymentStatus employmentStatus,
        LocalDate hireDate,
        LocalDate terminationDate,
        BigDecimal leaveDays,
        HrRosterInclusionReason inclusionReason,
        String sourceMovementId,
        LocalDateTime createdAt,
        String createdByActor
) {
    public static HrRosterItemResponse from(HrMonthlyRosterItem item) {
        return new HrRosterItemResponse(
                item.getId(),
                item.getEmployee().getId(),
                item.getDisplayOrder(),
                item.getDepartmentDisplayOrder(),
                item.getEmployeeCode(),
                item.getFullName(),
                item.getDepartmentCode(),
                item.getDepartmentName(),
                item.getPositionCode(),
                item.getPositionName(),
                item.getWorkingConditionCode(),
                item.getWorkingConditionName(),
                item.getEmploymentStatus(),
                item.getHireDate(),
                item.getTerminationDate(),
                item.getLeaveDays(),
                item.getInclusionReason(),
                item.getSourceMovement() == null ? null : item.getSourceMovement().getId(),
                item.getCreatedAt(),
                item.getCreatedByActor()
        );
    }

    public static HrRosterItemResponse fromProjection(HrRosterProjectionService.ProjectedRosterItem item) {
        return new HrRosterItemResponse(
                item.id(),
                item.employee().getId(),
                item.displayOrder(),
                item.departmentDisplayOrder(),
                item.employeeCode(),
                item.fullName(),
                item.departmentCode(),
                item.departmentName(),
                item.positionCode(),
                item.positionName(),
                item.workingConditionCode(),
                item.workingConditionName(),
                item.employmentStatus(),
                item.hireDate(),
                item.terminationDate(),
                item.leaveDays(),
                item.inclusionReason(),
                item.sourceMovement() == null ? null : item.sourceMovement().getId(),
                item.createdAt(),
                item.createdByActor()
        );
    }
}

package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrEmploymentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record HrLeaveSyncItemResponse(
        String employeeCode,
        String fullName,
        String department,
        String position,
        LocalDate hireDate,
        String workingCondition,
        String serviceYears,
        BigDecimal annualLeaveDays,
        HrEmploymentStatus employmentStatus,
        LocalDate resignationDate,
        String period
) {
}

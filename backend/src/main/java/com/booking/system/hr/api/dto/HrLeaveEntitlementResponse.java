package com.booking.system.hr.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record HrLeaveEntitlementResponse(
        String id,
        String employeeId,
        String employeeCode,
        String fullName,
        int leaveYear,
        String workingConditionName,
        LocalDate leaveAccrualStartDate,
        BigDecimal baseDays,
        BigDecimal seniorityBonusDays,
        BigDecimal calculatedDays,
        BigDecimal manualOverrideDays,
        BigDecimal finalDays,
        String note,
        long rowVersion,
        LocalDateTime updatedAt
) {
}

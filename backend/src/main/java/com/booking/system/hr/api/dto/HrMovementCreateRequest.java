package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrMovementType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record HrMovementCreateRequest(
        @NotBlank @Size(max = 36) String employeeId,
        @NotNull HrMovementType movementType,
        @NotNull LocalDate effectiveDate,
        @Size(max = 1000) String reason,
        @Size(max = 100) String decisionNumber,
        LocalDate decisionDate,
        @NotBlank @Size(max = 100) String idempotencyKey
) {
}

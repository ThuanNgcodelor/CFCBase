package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrMovementType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Command for a new auditable movement that replaces a confirmed manual movement. */
public record HrMovementAdjustmentRequest(
        @NotNull HrMovementType replacementMovementType,
        @NotNull LocalDate effectiveDate,
        @NotBlank @Size(max = 1000) String reason,
        @Size(max = 100) String decisionNumber,
        LocalDate decisionDate,
        @NotBlank @Size(max = 100) String idempotencyKey,
        long rowVersion
) {
}

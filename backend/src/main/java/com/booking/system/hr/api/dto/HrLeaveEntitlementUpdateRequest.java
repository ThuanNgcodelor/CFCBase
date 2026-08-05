package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record HrLeaveEntitlementUpdateRequest(
        @NotNull Integer leaveYear,
        @NotNull @PositiveOrZero Long rowVersion,
        @DecimalMin(value = "0.0") BigDecimal manualOverrideDays,
        @Size(max = 500) String note
) {
}

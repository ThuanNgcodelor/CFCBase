package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record HrRosterReopenRequest(
        @NotNull @PositiveOrZero Long rowVersion,
        @NotBlank @Size(max = 1000) String reason
) {
}

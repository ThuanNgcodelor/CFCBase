package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record HrVersionRequest(
        @NotNull @PositiveOrZero Long rowVersion
) {
}

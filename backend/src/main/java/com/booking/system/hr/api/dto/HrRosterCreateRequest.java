package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record HrRosterCreateRequest(
        @NotNull LocalDate periodStart
) {
}

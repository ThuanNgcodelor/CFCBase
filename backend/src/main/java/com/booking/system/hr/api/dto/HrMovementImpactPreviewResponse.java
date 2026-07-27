package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrMovementType;

import java.time.LocalDate;
import java.util.List;

/** Read-only result shown before a manager confirms a draft movement. */
public record HrMovementImpactPreviewResponse(
        String movementId,
        String employeeName,
        HrMovementType movementType,
        LocalDate effectiveDate,
        LocalDate affectedFrom,
        LocalDate affectedTo,
        List<PeriodImpact> periods
) {
    public record PeriodImpact(
            LocalDate periodStart,
            int beforeHeadcount,
            int afterHeadcount,
            int delta
    ) {
    }
}

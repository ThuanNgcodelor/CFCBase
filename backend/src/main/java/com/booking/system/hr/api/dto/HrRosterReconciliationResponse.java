package com.booking.system.hr.api.dto;

import java.time.LocalDate;
import java.util.List;

/** Read-only reconciliation for the live monthly roster projection. */
public record HrRosterReconciliationResponse(
        LocalDate baselinePeriodStart,
        int baselineSnapshotHeadcount,
        LocalDate currentPeriodStart,
        int currentHeadcount,
        int confirmedMovements,
        int confirmedAdjustments,
        List<PeriodSummary> periods
) {
    public record PeriodSummary(
            LocalDate periodStart,
            int headcount,
            int movementsApplied,
            int adjustmentsApplied
    ) {
    }
}

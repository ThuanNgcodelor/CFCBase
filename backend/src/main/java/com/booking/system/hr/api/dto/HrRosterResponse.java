package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.enums.HrRosterStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record HrRosterResponse(
        String id,
        LocalDate periodStart,
        HrRosterStatus status,
        int itemCount,
        LocalDateTime openedAt,
        String openedByActor,
        LocalDateTime closedAt,
        String closedByActor,
        LocalDateTime exportedAt,
        String exportedByActor,
        LocalDateTime createdAt,
        String createdByActor,
        long rowVersion
) {
    public static HrRosterResponse from(HrMonthlyRoster roster) {
        return new HrRosterResponse(
                roster.getId(),
                roster.getPeriodStart(),
                roster.getStatus(),
                roster.getItemCount(),
                roster.getOpenedAt(),
                roster.getOpenedByActor(),
                roster.getClosedAt(),
                roster.getClosedByActor(),
                roster.getExportedAt(),
                roster.getExportedByActor(),
                roster.getCreatedAt(),
                roster.getCreatedByActor(),
                roster.getRowVersion()
        );
    }
}

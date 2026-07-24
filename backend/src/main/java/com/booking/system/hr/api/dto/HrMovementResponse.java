package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementSourceKind;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.function.Function;

public record HrMovementResponse(
        String id,
        String employeeId,
        String employeeCode,
        String employeeName,
        HrMovementType movementType,
        HrMovementStatus status,
        LocalDate effectiveDate,
        String fromDepartment,
        String toDepartment,
        String fromPosition,
        String toPosition,
        String fromWorkingCondition,
        String toWorkingCondition,
        HrEmploymentStatus fromEmployeeStatus,
        HrEmploymentStatus toEmployeeStatus,
        String reason,
        String decisionNumber,
        LocalDate decisionDate,
        HrMovementSourceKind sourceKind,
        LocalDateTime confirmedAt,
        String confirmedByActor,
        LocalDateTime cancelledAt,
        String cancelledByActor,
        LocalDateTime createdAt,
        String createdByActor,
        long rowVersion
) {
    public static HrMovementResponse from(HrEmployeeMovement movement) {
        return from(movement, Function.identity());
    }

    public static HrMovementResponse from(HrEmployeeMovement movement, Function<String, String> actorResolver) {
        return new HrMovementResponse(
                movement.getId(),
                movement.getEmployee().getId(),
                movement.getEmployee().getEmployeeCode(),
                movement.getEmployee().getFullName(),
                movement.getMovementType(),
                movement.getStatus(),
                movement.getEffectiveDate(),
                catalogName(movement.getFromDepartment()),
                catalogName(movement.getToDepartment()),
                catalogName(movement.getFromPosition()),
                catalogName(movement.getToPosition()),
                catalogName(movement.getFromWorkingCondition()),
                catalogName(movement.getToWorkingCondition()),
                movement.getFromEmployeeStatus(),
                movement.getToEmployeeStatus(),
                movement.getReason(),
                movement.getDecisionNumber(),
                movement.getDecisionDate(),
                movement.getSourceKind(),
                movement.getConfirmedAt(),
                actorResolver.apply(movement.getConfirmedByActor()),
                movement.getCancelledAt(),
                actorResolver.apply(movement.getCancelledByActor()),
                movement.getCreatedAt(),
                actorResolver.apply(movement.getCreatedByActor()),
                movement.getRowVersion()
        );
    }

    private static String catalogName(HrCatalogEntity catalog) {
        return catalog == null ? null : catalog.getName();
    }
}

package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrAuditEvent;

import java.time.LocalDateTime;

public record HrAuditEventResponse(
        Long id,
        String actorSubject,
        String actorDisplayName,
        String actorRole,
        String action,
        String entityType,
        String entityId,
        String correlationId,
        String sanitizedMetadata,
        LocalDateTime occurredAt
) {
    public static HrAuditEventResponse from(HrAuditEvent event) {
        return new HrAuditEventResponse(
                event.getId(),
                event.getActorSubject(),
                event.getActorDisplayName(),
                event.getActorRole(),
                event.getAction(),
                event.getEntityType(),
                event.getEntityId(),
                event.getCorrelationId(),
                event.getSanitizedMetadata(),
                event.getOccurredAt()
        );
    }
}

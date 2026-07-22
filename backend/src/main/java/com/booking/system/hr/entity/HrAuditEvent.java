package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Getter
@Setter
@Entity
@Immutable
@Table(
        name = "hr_audit_events",
        indexes = {
                @Index(name = "idx_hr_audit_entity", columnList = "entity_type, entity_id, occurred_at"),
                @Index(name = "idx_hr_audit_actor", columnList = "actor_subject, occurred_at"),
                @Index(name = "idx_hr_audit_correlation", columnList = "correlation_id")
        }
)
public class HrAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_subject", nullable = false, length = 320)
    private String actorSubject;

    @Column(name = "actor_display_name")
    private String actorDisplayName;

    @Column(name = "actor_role", nullable = false, length = 32)
    private String actorRole;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 64)
    private String entityType;

    @Column(name = "entity_id", length = 36)
    private String entityId;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "changed_fields", columnDefinition = "json")
    private String changedFields;

    @Column(name = "sanitized_metadata", columnDefinition = "json")
    private String sanitizedMetadata;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private LocalDateTime occurredAt;

    @PrePersist
    protected void initializeOccurredAt() {
        if (occurredAt == null) {
            occurredAt = LocalDateTime.now(ZoneOffset.UTC);
        }
    }
}

package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrRosterInclusionReason;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Getter
@Setter
@Entity
@Table(
        name = "hr_monthly_roster_items",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_roster_item_employee", columnNames = {"roster_id", "employee_id"}),
                @UniqueConstraint(name = "uk_hr_roster_item_code", columnNames = {"roster_id", "employee_code"}),
                @UniqueConstraint(name = "uk_hr_roster_item_order", columnNames = {"roster_id", "display_order"})
        },
        indexes = {
                @Index(name = "idx_hr_roster_item_employee", columnList = "employee_id, roster_id"),
                @Index(name = "idx_hr_roster_item_movement", columnList = "source_movement_id")
        }
)
public class HrMonthlyRosterItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "roster_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_roster_item_roster"))
    private HrMonthlyRoster roster;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_roster_item_employee"))
    private HrEmployee employee;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "department_display_order")
    private Integer departmentDisplayOrder;

    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "department_code", length = 32)
    private String departmentCode;

    @Column(name = "department_name")
    private String departmentName;

    @Column(name = "position_code", length = 32)
    private String positionCode;

    @Column(name = "position_name")
    private String positionName;

    @Column(name = "working_condition_code", length = 32)
    private String workingConditionCode;

    @Column(name = "working_condition_name")
    private String workingConditionName;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_status", nullable = false, length = 16)
    private HrEmploymentStatus employmentStatus;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "termination_date")
    private LocalDate terminationDate;

    @Column(name = "leave_days", precision = 6, scale = 2)
    private BigDecimal leaveDays;

    @Enumerated(EnumType.STRING)
    @Column(name = "inclusion_reason", nullable = false, length = 20)
    private HrRosterInclusionReason inclusionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_movement_id", foreignKey = @ForeignKey(name = "fk_hr_roster_item_movement"))
    private HrEmployeeMovement sourceMovement;

    @Column(name = "snapshot_schema_version", nullable = false)
    private short snapshotSchemaVersion = 1;

    @Column(name = "snapshot_payload", nullable = false, columnDefinition = "json")
    private String snapshotPayload;

    @Column(name = "payload_sha256", nullable = false, length = 64)
    private String payloadSha256;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by_actor", nullable = false, updatable = false, length = 320)
    private String createdByActor;

    @PrePersist
    protected void initializeCreatedAt() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now(ZoneOffset.UTC);
        }
    }
}

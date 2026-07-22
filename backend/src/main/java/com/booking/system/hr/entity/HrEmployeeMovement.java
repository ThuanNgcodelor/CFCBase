package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementSourceKind;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_employee_movements",
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_movement_idempotency", columnNames = "idempotency_key"),
        indexes = {
                @Index(name = "idx_hr_movement_employee_date", columnList = "employee_id, effective_date, status"),
                @Index(name = "idx_hr_movement_status_date_type", columnList = "status, effective_date, movement_type"),
                @Index(name = "idx_hr_movement_import_batch", columnList = "import_batch_id")
        }
)
public class HrEmployeeMovement extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_movement_employee"))
    private HrEmployee employee;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 40)
    private HrMovementType movementType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrMovementStatus status = HrMovementStatus.DRAFT;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_department_id", foreignKey = @ForeignKey(name = "fk_hr_movement_from_department"))
    private HrDepartment fromDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_department_id", foreignKey = @ForeignKey(name = "fk_hr_movement_to_department"))
    private HrDepartment toDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_position_id", foreignKey = @ForeignKey(name = "fk_hr_movement_from_position"))
    private HrPosition fromPosition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_position_id", foreignKey = @ForeignKey(name = "fk_hr_movement_to_position"))
    private HrPosition toPosition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_working_condition_id", foreignKey = @ForeignKey(name = "fk_hr_movement_from_condition"))
    private HrWorkingCondition fromWorkingCondition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_working_condition_id", foreignKey = @ForeignKey(name = "fk_hr_movement_to_condition"))
    private HrWorkingCondition toWorkingCondition;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_employee_status", length = 16)
    private HrEmploymentStatus fromEmployeeStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_employee_status", length = 16)
    private HrEmploymentStatus toEmployeeStatus;

    @Column(name = "reason", length = 1000)
    private String reason;

    @Column(name = "decision_number", length = 100)
    private String decisionNumber;

    @Column(name = "decision_date")
    private LocalDate decisionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_kind", nullable = false, length = 20)
    private HrMovementSourceKind sourceKind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id", foreignKey = @ForeignKey(name = "fk_hr_movement_import_batch"))
    private HrExcelImportBatch importBatch;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "confirmed_by_actor", length = 320)
    private String confirmedByActor;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancelled_by_actor", length = 320)
    private String cancelledByActor;
}

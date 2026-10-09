package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrSalaryChangeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_employee_salary_changes",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_salary_change_idempotency", columnNames = "idempotency_key"),
                @UniqueConstraint(name = "uk_hr_salary_change_import_row", columnNames = {"import_batch_id", "source_row_number"})
        },
        indexes = {
                @Index(name = "idx_hr_salary_change_employee_effective", columnList = "employee_id, effective_date, status"),
                @Index(name = "idx_hr_salary_change_import", columnList = "import_batch_id"),
                @Index(name = "idx_hr_salary_change_scheduled", columnList = "status, effective_date")
        }
)
public class HrEmployeeSalaryChange extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_hr_salary_change_employee"))
    private HrEmployee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id",
            foreignKey = @ForeignKey(name = "fk_hr_salary_change_import"))
    private HrExcelImportBatch importBatch;

    @Column(name = "source_row_number")
    private Integer sourceRowNumber;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrSalaryChangeStatus status;

    @Column(name = "old_base_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal oldBaseSalary;

    @Column(name = "new_base_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal newBaseSalary;

    @Column(name = "old_allowance", nullable = false, precision = 15, scale = 2)
    private BigDecimal oldAllowance;

    @Column(name = "new_allowance", nullable = false, precision = 15, scale = 2)
    private BigDecimal newAllowance;

    @Column(name = "old_grade", length = 40)
    private String oldGrade;

    @Column(name = "new_grade", nullable = false, length = 40)
    private String newGrade;

    @Column(name = "salary_scale_code", length = 64)
    private String salaryScaleCode;

    @Column(name = "review_cycle_months")
    private Integer reviewCycleMonths;

    @Column(name = "next_review_date")
    private LocalDate nextReviewDate;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "applied_by_actor", length = 320)
    private String appliedByActor;

    @Column(name = "rolled_back_at")
    private LocalDateTime rolledBackAt;

    @Column(name = "rolled_back_by_actor", length = 320)
    private String rolledBackByActor;

    @Column(name = "rollback_reason", length = 1000)
    private String rollbackReason;
}

package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrEmploymentContractStatus;
import com.booking.system.hr.enums.HrEmploymentContractType;
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
        name = "hr_employment_contracts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_employment_contract_number", columnNames = "contract_number"),
                @UniqueConstraint(name = "uk_hr_employment_contract_idempotency", columnNames = "idempotency_key")
        },
        indexes = {
                @Index(name = "idx_hr_employment_contract_employee_status", columnList = "employee_id, status, effective_from"),
                @Index(name = "idx_hr_employment_contract_probation", columnList = "source_probation_candidate_id")
        }
)
public class HrEmploymentContract extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_hr_employment_contract_employee"))
    private HrEmployee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_probation_candidate_id",
            foreignKey = @ForeignKey(name = "fk_hr_employment_contract_probation"))
    private HrProbationCandidate sourceProbationCandidate;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", nullable = false, length = 32)
    private HrEmploymentContractType contractType;

    @Column(name = "contract_number", nullable = false, length = 100)
    private String contractNumber;

    @Column(name = "sign_date", nullable = false)
    private LocalDate signDate;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_until")
    private LocalDate effectiveUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrEmploymentContractStatus status = HrEmploymentContractStatus.READY;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "activated_by_actor", length = 320)
    private String activatedByActor;
}

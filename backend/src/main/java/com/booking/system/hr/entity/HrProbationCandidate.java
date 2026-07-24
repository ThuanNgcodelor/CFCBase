package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrProbationCandidateStatus;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_probation_candidates",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_probation_candidate_code", columnNames = "candidate_code"),
                @UniqueConstraint(name = "uk_hr_probation_candidate_converted_employee", columnNames = "converted_employee_id")
        },
        indexes = {
                @Index(name = "idx_hr_probation_candidate_status_end", columnList = "status, probation_end_date"),
                @Index(name = "idx_hr_probation_candidate_name", columnList = "full_name"),
                @Index(name = "idx_hr_probation_candidate_department", columnList = "department_id, status")
        }
)
public class HrProbationCandidate extends HrBaseEntity {

    @Column(name = "candidate_code", nullable = false, length = 32)
    private String candidateCode;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "candidate_title", length = 16)
    private String candidateTitle;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false, length = 16)
    private HrEmployeeGender gender = HrEmployeeGender.UNKNOWN;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "birth_place", length = 500)
    private String birthPlace;

    @Column(name = "nationality", nullable = false, length = 100)
    private String nationality = "Việt Nam";

    @Column(name = "citizen_id", length = 32)
    private String citizenId;

    @Column(name = "citizen_id_issued_date")
    private LocalDate citizenIdIssuedDate;

    @Column(name = "citizen_id_issued_place")
    private String citizenIdIssuedPlace;

    @Column(name = "permanent_address", length = 1000)
    private String permanentAddress;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "email", length = 320)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", foreignKey = @ForeignKey(name = "fk_hr_probation_candidate_department"))
    private HrDepartment department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id", foreignKey = @ForeignKey(name = "fk_hr_probation_candidate_position"))
    private HrPosition position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "working_condition_id", foreignKey = @ForeignKey(name = "fk_hr_probation_candidate_condition"))
    private HrWorkingCondition workingCondition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_template_id", foreignKey = @ForeignKey(name = "fk_hr_probation_candidate_template"))
    private HrProbationJobTemplate jobTemplate;

    @Column(name = "probation_contract_type", length = 100)
    private String probationContractType;

    @Column(name = "probation_start_date")
    private LocalDate probationStartDate;

    @Column(name = "probation_end_date")
    private LocalDate probationEndDate;

    @Column(name = "base_salary", precision = 15, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "salary_note")
    private String salaryNote;

    @Column(name = "job_description", length = 2000)
    private String jobDescription;

    @Column(name = "department_rule_note", length = 500)
    private String departmentRuleNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private HrProbationCandidateStatus status = HrProbationCandidateStatus.DRAFT;

    @Column(name = "status_reason", length = 1000)
    private String statusReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_employee_id", foreignKey = @ForeignKey(name = "fk_hr_probation_candidate_employee"))
    private HrEmployee convertedEmployee;

    @Column(name = "converted_at")
    private LocalDateTime convertedAt;

    @Column(name = "converted_by_actor", length = 320)
    private String convertedByActor;
}

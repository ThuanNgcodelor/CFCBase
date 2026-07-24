package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrCatalogStatus;
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

@Getter
@Setter
@Entity
@Table(
        name = "hr_probation_job_templates",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_probation_job_template_code", columnNames = "code"),
                @UniqueConstraint(name = "uk_hr_probation_job_template_name", columnNames = "name")
        },
        indexes = {
                @Index(name = "idx_hr_probation_template_status_sort", columnList = "status, sort_order, name")
        }
)
public class HrProbationJobTemplate extends HrBaseEntity {

    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", foreignKey = @ForeignKey(name = "fk_hr_probation_template_department"))
    private HrDepartment department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id", foreignKey = @ForeignKey(name = "fk_hr_probation_template_position"))
    private HrPosition position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "working_condition_id", foreignKey = @ForeignKey(name = "fk_hr_probation_template_condition"))
    private HrWorkingCondition workingCondition;

    @Column(name = "probation_contract_type", length = 100)
    private String probationContractType;

    @Column(name = "job_description", length = 2000)
    private String jobDescription;

    @Column(name = "base_salary", precision = 15, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "salary_note")
    private String salaryNote;

    @Column(name = "department_rule_note", length = 500)
    private String departmentRuleNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrCatalogStatus status = HrCatalogStatus.ACTIVE;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}

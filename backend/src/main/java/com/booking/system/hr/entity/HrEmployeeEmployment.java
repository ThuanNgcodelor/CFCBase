package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "hr_employee_employment",
        indexes = {
                @Index(name = "idx_hr_employment_department", columnList = "department_id"),
                @Index(name = "idx_hr_employment_position", columnList = "position_id"),
                @Index(name = "idx_hr_employment_condition", columnList = "working_condition_id"),
                @Index(name = "idx_hr_employment_hire_date", columnList = "hire_date"),
                @Index(name = "idx_hr_employment_contract", columnList = "contract_number")
        }
)
public class HrEmployeeEmployment extends HrAuditable {

    @Id
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_employment_employee"))
    private HrEmployee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", foreignKey = @ForeignKey(name = "fk_hr_employment_department"))
    private HrDepartment department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id", foreignKey = @ForeignKey(name = "fk_hr_employment_position"))
    private HrPosition position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "working_condition_id", foreignKey = @ForeignKey(name = "fk_hr_employment_condition"))
    private HrWorkingCondition workingCondition;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "leave_accrual_start_date")
    private LocalDate leaveAccrualStartDate;

    @Column(name = "termination_date")
    private LocalDate terminationDate;

    @Column(name = "contract_type_label", length = 100)
    private String contractTypeLabel;

    @Column(name = "contract_number", length = 100)
    private String contractNumber;

    @Column(name = "base_salary", precision = 15, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "allowance", precision = 15, scale = 2)
    private BigDecimal allowance;

    @Column(name = "job_description", length = 2000)
    private String jobDescription;
}

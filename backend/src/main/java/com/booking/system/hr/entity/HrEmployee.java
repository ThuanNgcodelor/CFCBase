package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrEmploymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "hr_employees",
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_employee_code", columnNames = "employee_code"),
        indexes = {
                @Index(name = "idx_hr_employees_status_code", columnList = "employment_status, employee_code"),
                @Index(name = "idx_hr_employees_full_name", columnList = "full_name"),
                @Index(name = "idx_hr_employees_source_batch", columnList = "source_import_batch_id")
        }
)
public class HrEmployee extends HrBaseEntity {

    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false, length = 16)
    private HrEmployeeGender gender = HrEmployeeGender.UNKNOWN;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "ethnicity", length = 100)
    private String ethnicity;

    @Column(name = "religion", length = 100)
    private String religion;

    @Column(name = "birth_place_original", length = 500)
    private String birthPlaceOriginal;

    @Column(name = "birth_place_current", length = 500)
    private String birthPlaceCurrent;

    @Column(name = "education_level")
    private String educationLevel;

    @Column(name = "major")
    private String major;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_status", nullable = false, length = 16)
    private HrEmploymentStatus employmentStatus = HrEmploymentStatus.DRAFT;

    @Column(name = "status_effective_date")
    private LocalDate statusEffectiveDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_import_batch_id", foreignKey = @ForeignKey(name = "fk_hr_employee_source_batch"))
    private HrExcelImportBatch sourceImportBatch;

    @OneToOne(mappedBy = "employee", fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    private HrEmployeeEmployment employment;

    @OneToOne(mappedBy = "employee", fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    private HrEmployeeIdentity identity;

    @OneToOne(mappedBy = "employee", fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    private HrEmployeeInsurance insurance;

    @OneToOne(mappedBy = "employee", fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    private HrEmployeeContact contact;
}

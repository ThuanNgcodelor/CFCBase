package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrInsuranceStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "hr_employee_insurance",
        indexes = {
                @Index(name = "idx_hr_insurance_social_number", columnList = "social_insurance_number"),
                @Index(name = "idx_hr_insurance_health_number", columnList = "health_insurance_number")
        }
)
public class HrEmployeeInsurance extends HrAuditable {

    @Id
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_insurance_employee"))
    private HrEmployee employee;

    @Column(name = "social_insurance_number", length = 32)
    private String socialInsuranceNumber;

    @Column(name = "health_insurance_number", length = 32)
    private String healthInsuranceNumber;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private HrInsuranceStatus status = HrInsuranceStatus.UNKNOWN;
}

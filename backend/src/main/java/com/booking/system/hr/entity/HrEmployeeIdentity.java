package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrIdentityVerificationStatus;
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
        name = "hr_employee_identity",
        indexes = {
                @Index(name = "idx_hr_identity_legacy_number", columnList = "legacy_identity_number"),
                @Index(name = "idx_hr_identity_citizen_number", columnList = "citizen_identity_number")
        }
)
public class HrEmployeeIdentity extends HrAuditable {

    @Id
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_identity_employee"))
    private HrEmployee employee;

    @Column(name = "legacy_identity_number", length = 32)
    private String legacyIdentityNumber;

    @Column(name = "citizen_identity_number", length = 32)
    private String citizenIdentityNumber;

    @Column(name = "issued_date")
    private LocalDate issuedDate;

    @Column(name = "issued_place")
    private String issuedPlace;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private HrIdentityVerificationStatus verificationStatus = HrIdentityVerificationStatus.UNVERIFIED;
}

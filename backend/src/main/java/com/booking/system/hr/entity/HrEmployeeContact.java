package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Getter
@Setter
@Entity
@Table(
        name = "hr_employee_contacts",
        indexes = @Index(name = "idx_hr_contacts_phone", columnList = "phone")
)
public class HrEmployeeContact extends HrAuditable {

    @Id
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_contacts_employee"))
    private HrEmployee employee;

    @Column(name = "permanent_address", length = 1000)
    private String permanentAddress;

    @Column(name = "current_address", length = 1000)
    private String currentAddress;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "work_email", length = 320)
    private String workEmail;

    @Column(name = "personal_email", length = 320)
    private String personalEmail;

    @Column(name = "emergency_contact_name")
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 32)
    private String emergencyContactPhone;

    @Column(name = "emergency_contact_relation", length = 100)
    private String emergencyContactRelation;
}

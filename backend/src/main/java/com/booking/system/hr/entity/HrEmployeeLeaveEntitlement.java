package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
        name = "hr_employee_leave_entitlements",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_leave_entitlement_employee_year", columnNames = {"employee_id", "leave_year"})
        },
        indexes = {
                @Index(name = "idx_hr_leave_entitlement_year", columnList = "leave_year")
        }
)
public class HrEmployeeLeaveEntitlement extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_leave_entitlement_employee"))
    private HrEmployee employee;

    @Column(name = "leave_year", nullable = false)
    private short leaveYear;

    @Column(name = "manual_override_days", precision = 6, scale = 2)
    private BigDecimal manualOverrideDays;

    @Column(name = "note", length = 500)
    private String note;
}

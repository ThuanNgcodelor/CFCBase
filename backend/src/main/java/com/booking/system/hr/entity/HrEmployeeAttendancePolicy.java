package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendancePolicyGroup;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "hr_employee_attendance_policies")
public class HrEmployeeAttendancePolicy extends HrBaseEntity {
    @Column(name = "employee_id", nullable = false, length = 36) 
    private String employeeId;
    @Enumerated(EnumType.STRING) @Column(name = "policy_group", nullable = false, length = 32) 
    private HrAttendancePolicyGroup policyGroup;
    @Column(name = "valid_from", nullable = false) 
    private LocalDate validFrom;
    @Column(name = "valid_to") 
    private LocalDate validTo;
    @Column(nullable = false, length = 32) 
    private String source;
    @Column(nullable = false, length = 1000) 
    private String reason;
}

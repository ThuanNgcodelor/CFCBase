package com.booking.system.hr.entity;

import com.booking.system.hr.enums.*;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_shifts")
public class HrProductionAttendanceShift extends HrBaseEntity {
    @Column(name = "import_id", nullable = false, length = 36) 
    private String importId;
    @Column(name = "employee_id", length = 36) 
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32) 
    private String employeeCode;
    @Column(name = "employee_name") 
    private String employeeName;
    @Column(name = "work_date", nullable = false) 
    private LocalDate workDate;
    @Column(name = "calculation_version", nullable = false) 
    private int calculationVersion;
    @Column(nullable = false) 
    private boolean active = true;
    @Enumerated(EnumType.STRING) @Column(name = "policy_group", nullable = false, length = 32) 
    private HrAttendancePolicyGroup policyGroup;
    @Column(name = "shift_policy_id", length = 36) 
    private String shiftPolicyId;
    @Column(name = "shift_code_snapshot", length = 40) 
    private String shiftCodeSnapshot;
    @Column(name = "work_credit_rule_id", length = 36) 
    private String workCreditRuleId;
    @Column(name = "check_in_punch_id", length = 36) 
    private String checkInPunchId;
    @Column(name = "check_out_punch_id", length = 36) 
    private String checkOutPunchId;
    @Column(name = "check_in_at") 
    private LocalDateTime checkInAt;
    @Column(name = "check_out_at") 
    private LocalDateTime checkOutAt;
    @Column(name = "work_value", nullable = false, precision = 4, scale = 2) 
    private BigDecimal workValue = BigDecimal.ZERO;
    @Column(name = "night_allowance_amount", nullable = false, precision = 15, scale = 2) 
    private BigDecimal nightAllowanceAmount = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32) 
    private HrProductionAttendanceShiftStatus status;
    @Enumerated(EnumType.STRING) @Column(name = "resolution_type", nullable = false, length = 32) 
    private HrAttendanceResolutionType resolutionType;
    @Column(length = 2000) 
    private String explanation;
    @Column(name = "incident_id", length = 36) 
    private String incidentId;
    @Column(name = "confirmed_at") 
    private LocalDateTime confirmedAt;
    @Column(name = "confirmed_by_actor", length = 320) 
    private String confirmedByActor;
}

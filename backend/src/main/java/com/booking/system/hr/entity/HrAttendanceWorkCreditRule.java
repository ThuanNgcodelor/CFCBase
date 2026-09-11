package com.booking.system.hr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_work_credit_rules")
public class HrAttendanceWorkCreditRule extends HrBaseEntity {
    @Column(name = "shift_policy_id", nullable = false, length = 36) 
    private String shiftPolicyId;
    @Column(nullable = false) 
    private String name;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_out_from", nullable = false) 
    private LocalTime checkOutFrom;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_out_until", nullable = false) 
    private LocalTime checkOutUntil;
    @Column(name = "work_value", nullable = false, precision = 4, scale = 2) 
    private BigDecimal workValue;
    @Column(nullable = false) 
    private int priority;
    @Column(nullable = false) 
    private boolean active = true;
    @Column(name = "valid_from", nullable = false) 
    private LocalDate validFrom;
    @Column(name = "valid_to") 
    private LocalDate validTo;
}

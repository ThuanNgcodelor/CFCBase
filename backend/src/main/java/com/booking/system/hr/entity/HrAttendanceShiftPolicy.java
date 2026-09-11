package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendancePolicyGroup;
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
@Table(name = "hr_attendance_shift_policies")
public class HrAttendanceShiftPolicy extends HrBaseEntity {
    @Column(nullable = false, unique = true, length = 40) 
    private String code;
    @Column(nullable = false) 
    private String name;
    @Enumerated(EnumType.STRING) @Column(name = "policy_group", nullable = false, length = 32) 
    private HrAttendancePolicyGroup policyGroup;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "standard_start", nullable = false) 
    private LocalTime standardStart;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "standard_end", nullable = false) 
    private LocalTime standardEnd;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_in_from", nullable = false) 
    private LocalTime checkInFrom;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_in_until", nullable = false) 
    private LocalTime checkInUntil;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_out_from", nullable = false) 
    private LocalTime checkOutFrom;
    @JdbcTypeCode(SqlTypes.LOCAL_TIME) @Column(name = "check_out_until", nullable = false) 
    private LocalTime checkOutUntil;
    @Column(name = "crosses_midnight", nullable = false) 
    private boolean crossesMidnight;
    @Column(name = "night_allowance_amount", nullable = false, precision = 15, scale = 2) 
    private BigDecimal nightAllowanceAmount = BigDecimal.ZERO;
    @Column(nullable = false) 
    private int priority;
    @Column(nullable = false) 
    private boolean active = true;
    @Column(name = "valid_from", nullable = false) 
    private LocalDate validFrom;
    @Column(name = "valid_to") 
    private LocalDate validTo;
}

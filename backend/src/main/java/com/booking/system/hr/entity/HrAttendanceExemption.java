package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendanceExemptionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_exemptions")
public class HrAttendanceExemption extends HrBaseEntity {
    @Column(name = "employee_id", nullable = false, length = 36) 
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32) 
    private String employeeCode;
    @Column(name = "valid_from", nullable = false) 
    private LocalDate validFrom;
    @Column(name = "valid_to", nullable = false) 
    private LocalDate validTo;
    @Column(nullable = false, length = 1000) 
    private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) 
    private HrAttendanceExemptionStatus status;
    @Column(name = "confirmed_at") 
    private LocalDateTime confirmedAt;
    @Column(name = "confirmed_by_actor", length = 320) 
    private String confirmedByActor;
    @Column(name = "cancelled_at") 
    private LocalDateTime cancelledAt;
    @Column(name = "cancelled_by_actor", length = 320) 
    private String cancelledByActor;
    @Column(name = "cancellation_reason", length = 1000) 
    private String cancellationReason;
}

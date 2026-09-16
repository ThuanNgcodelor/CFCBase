package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrNightRewardExceptionStatus;
import com.booking.system.hr.enums.HrNightRewardExceptionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_night_reward_exceptions")
public class HrNightRewardException extends HrBaseEntity {
    @Column(name = "program_id", nullable = false, length = 36)
    private String programId;
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "attendance_month", nullable = false, length = 7)
    private String attendanceMonth;
    @Enumerated(EnumType.STRING)
    @Column(name = "exception_type", nullable = false, length = 40)
    private HrNightRewardExceptionType exceptionType;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private HrNightRewardExceptionStatus status = HrNightRewardExceptionStatus.DRAFT;
    @Column(nullable = false, length = 1000)
    private String reason;
    @Column(name = "evidence_reference", length = 1000)
    private String evidenceReference;
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;
    @Column(name = "reviewed_by_actor", length = 320)
    private String reviewedByActor;
    @Column(name = "review_reason", length = 1000)
    private String reviewReason;
    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;
    @Column(name = "cancelled_by_actor", length = 320)
    private String cancelledByActor;
    @Column(name = "cancellation_reason", length = 1000)
    private String cancellationReason;
}

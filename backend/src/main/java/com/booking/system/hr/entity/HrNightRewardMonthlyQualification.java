package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrNightRewardMonthlyStatus;
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
@Table(name = "hr_night_reward_monthly_qualifications")
public class HrNightRewardMonthlyQualification extends HrBaseEntity {
    @Column(name = "program_id", nullable = false, length = 36)
    private String programId;
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "employee_name", nullable = false)
    private String employeeName;
    @Column(name = "attendance_month", nullable = false, length = 7)
    private String attendanceMonth;
    @Column(nullable = false)
    private int revision = 1;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private HrNightRewardMonthlyStatus status;
    @Column(name = "actual_night_shift_count", nullable = false)
    private int actualNightShiftCount;
    @Column(name = "required_night_shift_count", nullable = false)
    private int requiredNightShiftCount;
    @Column(name = "qualification_reason", nullable = false, length = 1000)
    private String qualificationReason;
    @Column(name = "source_snapshot_json", nullable = false, columnDefinition = "JSON")
    private String sourceSnapshotJson;
    @Column(name = "finalized_at", nullable = false)
    private LocalDateTime finalizedAt;
    @Column(name = "finalized_by_actor", nullable = false, length = 320)
    private String finalizedByActor;
    @Column(name = "stale_at")
    private LocalDateTime staleAt;
    @Column(name = "stale_by_actor", length = 320)
    private String staleByActor;
    @Column(name = "stale_reason", length = 1000)
    private String staleReason;
}

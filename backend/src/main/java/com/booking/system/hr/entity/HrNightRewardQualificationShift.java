package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "hr_night_reward_qualification_shifts")
public class HrNightRewardQualificationShift extends HrBaseEntity {
    @Column(name = "qualification_id", nullable = false, length = 36)
    private String qualificationId;
    @Column(name = "attendance_shift_id", nullable = false, length = 36)
    private String attendanceShiftId;
    @Column(name = "source_import_id", nullable = false, length = 36)
    private String sourceImportId;
    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;
    @Column(name = "shift_code", nullable = false, length = 40)
    private String shiftCode;
}

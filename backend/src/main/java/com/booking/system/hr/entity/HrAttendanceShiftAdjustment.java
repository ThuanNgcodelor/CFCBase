package com.booking.system.hr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_shift_adjustments")
public class HrAttendanceShiftAdjustment extends HrBaseEntity {
    @Column(name = "shift_id", nullable = false, length = 36) 
    private String shiftId;
    @Column(name = "before_json", nullable = false, columnDefinition = "JSON") 
    private String beforeJson;
    @Column(name = "after_json", nullable = false, columnDefinition = "JSON") 
    private String afterJson;
    @Column(nullable = false, length = 1000) 
    private String reason;
}

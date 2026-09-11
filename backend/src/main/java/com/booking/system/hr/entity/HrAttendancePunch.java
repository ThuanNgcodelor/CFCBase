package com.booking.system.hr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_punches")
public class HrAttendancePunch extends HrBaseEntity {
    @Column(name = "import_id", nullable = false, length = 36) 
    private String importId;
    @Column(name = "source_day_id", nullable = false, length = 36) 
    private String sourceDayId;
    @Column(name = "employee_id", length = 36) 
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32) 
    private String employeeCode;
    @Column(name = "employee_name") 
    private String employeeName;
    @Column(name = "work_date", nullable = false) 
    private LocalDate workDate;
    @Column(name = "punched_at", nullable = false) 
    private LocalDateTime punchedAt;
    @Column(name = "source_row_number", nullable = false) 
    private int sourceRowNumber;
    @Column(name = "source_column", nullable = false, length = 8) 
    private String sourceColumn;
    @Column(name = "raw_value", nullable = false, length = 100) 
    private String rawValue;
}

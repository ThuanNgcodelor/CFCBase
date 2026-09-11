package com.booking.system.hr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_source_days")
public class HrAttendanceSourceDay extends HrBaseEntity {
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
    @Column(name = "source_row_number", nullable = false) 
    private int sourceRowNumber;
}

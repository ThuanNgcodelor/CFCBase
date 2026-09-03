package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendanceRecordStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_records", indexes = {
        @Index(name = "idx_hr_attendance_record_import", columnList = "import_id, source_row_number"),
        @Index(name = "idx_hr_attendance_record_employee_date", columnList = "employee_code, work_date")
})
public class HrAttendanceRecord extends HrBaseEntity {
    @Column(name = "import_id", nullable = false, length = 36)
    private String importId;
    @Column(name = "employee_id", length = 36)
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "employee_name")
    private String employeeName;
    @Column(name = "work_date")
    private LocalDate workDate;
    @Column(name = "punches_json", columnDefinition = "JSON")
    private String punchesJson;
    @Column(name = "check_in")
    private LocalTime checkIn;
    @Column(name = "check_out")
    private LocalTime checkOut;
    @Column(name = "work_value", nullable = false, precision = 4, scale = 2)
    private BigDecimal workValue = BigDecimal.ZERO;
    @Column(name = "late_minutes", nullable = false)
    private int lateMinutes;
    @Column(name = "early_minutes", nullable = false)
    private int earlyMinutes;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrAttendanceRecordStatus status;
    @Column(name = "source_row_number", nullable = false)
    private int sourceRowNumber;
    @Column(name = "error_message", length = 1000)
    private String errorMessage;
}

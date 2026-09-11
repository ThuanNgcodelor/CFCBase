package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendanceImportStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_production_attendance_imports")
public class HrProductionAttendanceImport extends HrBaseEntity {
    @Column(name = "source_file_name", nullable = false) 
    private String sourceFileName;
    @Column(name = "file_sha256", nullable = false, unique = true, length = 64) 
    private String fileSha256;
    @Column(name = "file_size", nullable = false) 
    private long fileSize;
    @Column(name = "source_sheet_name", nullable = false, length = 100) 
    private String sourceSheetName;
    @Column(name = "attendance_month", nullable = false, length = 7) 
    private String attendanceMonth;
    @Column(name = "configuration_json", nullable = false, columnDefinition = "JSON") 
    private String configurationJson;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32) 
    private HrAttendanceImportStatus status;
    @Column(name = "processing_version", nullable = false) 
    private int processingVersion = 1;
    @Column(name = "total_rows", nullable = false) 
    private int totalRows;
    @Column(name = "total_punches", nullable = false) 
    private int totalPunches;
    @Column(name = "auto_matched_shifts", nullable = false) 
    private int autoMatchedShifts;
    @Column(name = "review_shifts", nullable = false) 
    private int reviewShifts;
    @Column(name = "no_punch_rows", nullable = false) 
    private int noPunchRows;
    @Column(name = "excluded_rows", nullable = false) 
    private int excludedRows;
    @Column(name = "last_error", length = 1000) 
    private String lastError;
    @Column(name = "confirmed_at") 
    private LocalDateTime confirmedAt;
    @Column(name = "confirmed_by_actor", length = 320) private String confirmedByActor;
}

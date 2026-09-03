package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendanceImportStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_imports", indexes = @Index(name = "idx_hr_attendance_import_created", columnList = "created_at"))
public class HrAttendanceImport extends HrBaseEntity {
    @Column(name = "source_file_name", nullable = false)
    private String sourceFileName;
    @Column(name = "file_sha256", nullable = false, length = 64)
    private String fileSha256;
    @Column(name = "file_size", nullable = false)
    private long fileSize;
    @Column(name = "source_sheet_name", nullable = false, length = 100)
    private String sourceSheetName;
    @Column(name = "attendance_month", length = 7)
    private String attendanceMonth;
    @Column(name = "header_row", nullable = false)
    private int headerRow;
    @Column(name = "configuration_json", nullable = false, columnDefinition = "JSON")
    private String configurationJson;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrAttendanceImportStatus status;
    @Column(name = "total_rows", nullable = false)
    private int totalRows;
    @Column(name = "valid_rows", nullable = false)
    private int validRows;
    @Column(name = "error_rows", nullable = false)
    private int errorRows;
    @jakarta.persistence.Transient
    private int excludedRows;
    @Column(name = "last_error", length = 1000)
    private String lastError;
}

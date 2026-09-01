package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrPayrollImportStatus;
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
@Table(name = "hr_payroll_imports", indexes = @Index(name = "idx_hr_payroll_import_status_created", columnList = "status, created_at"))
public class HrPayrollImport extends HrBaseEntity {
    @Column(name = "source_file_name", nullable = false)
    private String sourceFileName;
    @Column(name = "file_sha256", nullable = false, length = 64)
    private String fileSha256;
    @Column(name = "file_size", nullable = false)
    private long fileSize;
    @Column(name = "source_sheet_name", nullable = false, length = 100)
    private String sourceSheetName;
    @Column(name = "payroll_month", nullable = false, length = 7)
    private String payrollMonth;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrPayrollImportStatus status;
    @Column(name = "total_rows", nullable = false)
    private int totalRows;
    @Column(name = "valid_rows", nullable = false)
    private int validRows;
    @Column(name = "ready_rows", nullable = false)
    private int readyRows;
    @Column(name = "skipped_rows", nullable = false)
    private int skippedRows;
    @Column(name = "invalid_rows", nullable = false)
    private int invalidRows;
    @Column(name = "last_error", length = 1000)
    private String lastError;
}

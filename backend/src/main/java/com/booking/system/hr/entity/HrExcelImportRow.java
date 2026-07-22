package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrImportRowStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Getter
@Setter
@Entity
@Table(
        name = "hr_excel_import_rows",
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_import_row", columnNames = {"batch_id", "sheet_name", "source_row_number"}),
        indexes = {
                @Index(name = "idx_hr_import_row_status", columnList = "batch_id, row_status, source_row_number"),
                @Index(name = "idx_hr_import_row_employee", columnList = "employee_id")
        }
)
public class HrExcelImportRow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_import_row_batch"))
    private HrExcelImportBatch batch;

    @Column(name = "sheet_name", nullable = false, length = 100)
    private String sheetName;

    @Column(name = "source_row_number", nullable = false)
    private int rowNumber;

    @Column(name = "employee_code_hint", length = 32)
    private String employeeCodeHint;

    @Enumerated(EnumType.STRING)
    @Column(name = "row_status", nullable = false, length = 20)
    private HrImportRowStatus rowStatus = HrImportRowStatus.PENDING;

    @Column(name = "raw_payload", nullable = false, columnDefinition = "json")
    private String rawPayload;

    @Column(name = "normalized_payload", columnDefinition = "json")
    private String normalizedPayload;

    @Column(name = "payload_sha256", nullable = false, length = 64)
    private String payloadSha256;

    @Column(name = "issue_codes", columnDefinition = "json")
    private String issueCodes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_import_row_employee"))
    private HrEmployee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movement_id", foreignKey = @ForeignKey(name = "fk_hr_import_row_movement"))
    private HrEmployeeMovement movement;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void initializeTimestamps() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    protected void updateTimestamp() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}

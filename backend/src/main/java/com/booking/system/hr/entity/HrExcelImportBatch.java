package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_excel_import_batches",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_hr_import_file_attempt",
                        columnNames = {"file_sha256", "source_sheet_name", "import_type", "attempt_number"}
                ),
                @UniqueConstraint(name = "uk_hr_import_confirmation_key", columnNames = "confirmation_key")
        },
        indexes = {
                @Index(name = "idx_hr_import_status_created", columnList = "status, created_at"),
                @Index(name = "idx_hr_import_file_sha", columnList = "file_sha256")
        }
)
public class HrExcelImportBatch extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_version_id", foreignKey = @ForeignKey(name = "fk_hr_import_template"))
    private HrExcelTemplateVersion templateVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "import_type", nullable = false, length = 16)
    private HrImportType importType;

    @Column(name = "source_file_name", nullable = false)
    private String sourceFileName;

    @Column(name = "file_sha256", nullable = false, length = 64)
    private String fileSha256;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(name = "payload_retention_until")
    private LocalDateTime payloadRetentionUntil;

    @Column(name = "payload_purged_at")
    private LocalDateTime payloadPurgedAt;

    @Column(name = "payload_purged_by_actor", length = 320)
    private String payloadPurgedByActor;

    @Column(name = "source_sheet_name", nullable = false, length = 100)
    private String sourceSheetName;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber = 1;

    @Column(name = "source_period_year")
    private Short sourcePeriodYear;

    @Column(name = "source_period_month")
    private Byte sourcePeriodMonth;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private HrImportBatchStatus status = HrImportBatchStatus.UPLOADED;

    @Column(name = "total_rows", nullable = false)
    private int totalRows;

    @Column(name = "valid_rows", nullable = false)
    private int validRows;

    @Column(name = "warning_rows", nullable = false)
    private int warningRows;

    @Column(name = "invalid_rows", nullable = false)
    private int invalidRows;

    @Column(name = "imported_rows", nullable = false)
    private int importedRows;

    @Column(name = "issue_summary", columnDefinition = "json")
    private String issueSummary;

    @Column(name = "confirmation_key", length = 100)
    private String confirmationKey;

    @Column(name = "parsed_at")
    private LocalDateTime parsedAt;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "confirmed_by_actor", length = 320)
    private String confirmedByActor;

    @Column(name = "rolled_back_at")
    private LocalDateTime rolledBackAt;

    @Column(name = "rolled_back_by_actor", length = 320)
    private String rolledBackByActor;
}

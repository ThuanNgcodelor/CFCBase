package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrTemplateStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "hr_excel_template_versions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_template_key_version", columnNames = {"template_key", "version_code"}),
                @UniqueConstraint(name = "uk_hr_template_file_sha", columnNames = "file_sha256")
        }
)
public class HrExcelTemplateVersion extends HrBaseEntity {

    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    @Column(name = "version_code", nullable = false, length = 32)
    private String versionCode;

    @Column(name = "schema_version", nullable = false)
    private short schemaVersion;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_sha256", nullable = false, length = 64)
    private String fileSha256;

    @Column(name = "sheet_contract", nullable = false, columnDefinition = "json")
    private String sheetContract;

    @Column(name = "contains_pii", nullable = false)
    private boolean containsPii;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrTemplateStatus status = HrTemplateStatus.DRAFT;

    @Column(name = "effective_from")
    private LocalDate effectiveFrom;

    @Column(name = "effective_until")
    private LocalDate effectiveUntil;
}

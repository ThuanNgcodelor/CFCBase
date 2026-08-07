package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrWorkforceGroup;
import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Immutable
@Table(
        name = "hr_employment_contract_documents",
        indexes = {
                @Index(
                        name = "idx_hr_employment_contract_document_contract",
                        columnList = "employment_contract_id, generated_at"
                )
        }
)
public class HrEmploymentContractDocument extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "employment_contract_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_hr_employment_contract_document_contract")
    )
    private HrEmploymentContract employmentContract;

    @Enumerated(EnumType.STRING)
    @Column(name = "workforce_group", nullable = false, length = 32)
    private HrWorkforceGroup workforceGroup;

    @Column(name = "template_file_name", nullable = false)
    private String templateFileName;

    @Column(name = "template_sha256", nullable = false, length = 64, columnDefinition = "char(64)")
    private String templateSha256;

    @Column(name = "generated_file_name", nullable = false)
    private String generatedFileName;

    @Column(name = "generated_file_sha256", nullable = false, length = 64, columnDefinition = "char(64)")
    private String generatedFileSha256;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "generated_docx", nullable = false, columnDefinition = "MEDIUMBLOB")
    private byte[] generatedDocx;

    @Column(name = "snapshot_payload", nullable = false, columnDefinition = "json")
    private String snapshotPayload;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @Column(name = "generated_by_actor", nullable = false, length = 320)
    private String generatedByActor;
}

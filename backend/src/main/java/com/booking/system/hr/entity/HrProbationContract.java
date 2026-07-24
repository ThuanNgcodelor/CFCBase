package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrProbationContractStatus;
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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_probation_contracts",
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_probation_contract_no_year", columnNames = {"contract_no", "contract_year"}),
        indexes = {
                @Index(name = "idx_hr_probation_contract_candidate", columnList = "candidate_id, generated_at")
        }
)
public class HrProbationContract extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_probation_contract_candidate"))
    private HrProbationCandidate candidate;

    @Column(name = "contract_no", nullable = false, length = 32)
    private String contractNo;

    @Column(name = "contract_year", nullable = false)
    private short contractYear;

    @Column(name = "template_file_name", nullable = false)
    private String templateFileName;

    @Column(name = "template_sha256", nullable = false, length = 64)
    private String templateSha256;

    @Column(name = "generated_file_name", nullable = false)
    private String generatedFileName;

    @Column(name = "generated_file_sha256", nullable = false, length = 64)
    private String generatedFileSha256;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "generated_docx", nullable = false, columnDefinition = "MEDIUMBLOB")
    private byte[] generatedDocx;

    @Column(name = "snapshot_payload", nullable = false, columnDefinition = "json")
    private String snapshotPayload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrProbationContractStatus status = HrProbationContractStatus.GENERATED;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @Column(name = "generated_by_actor", nullable = false, length = 320)
    private String generatedByActor;
}

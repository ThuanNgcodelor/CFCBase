package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrRosterStatus;
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

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "hr_monthly_rosters",
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_roster_period", columnNames = "period_start"),
        indexes = {
                @Index(name = "idx_hr_roster_source", columnList = "source_roster_id"),
                @Index(name = "idx_hr_roster_import_batch", columnList = "source_import_batch_id")
        }
)
public class HrMonthlyRoster extends HrBaseEntity {

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrRosterStatus status = HrRosterStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_roster_id", foreignKey = @ForeignKey(name = "fk_hr_roster_source"))
    private HrMonthlyRoster sourceRoster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_import_batch_id", foreignKey = @ForeignKey(name = "fk_hr_roster_import_batch"))
    private HrExcelImportBatch sourceImportBatch;

    @Column(name = "snapshot_schema_version", nullable = false)
    private short snapshotSchemaVersion = 1;

    @Column(name = "item_count", nullable = false)
    private int itemCount;

    @Column(name = "roster_checksum", length = 64)
    private String rosterChecksum;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "opened_by_actor", length = 320)
    private String openedByActor;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "closed_by_actor", length = 320)
    private String closedByActor;

    @Column(name = "exported_at")
    private LocalDateTime exportedAt;

    @Column(name = "exported_by_actor", length = 320)
    private String exportedByActor;
}

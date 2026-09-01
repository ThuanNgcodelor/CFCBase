package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrPayrollCampaignStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_payroll_campaigns", indexes = @Index(name = "idx_hr_payroll_campaign_status", columnList = "status, created_at"))
public class HrPayrollCampaign extends HrBaseEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_id", nullable = false, unique = true, foreignKey = @ForeignKey(name = "fk_hr_payroll_campaign_import"))
    private HrPayrollImport payrollImport;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrPayrollCampaignStatus status;
    @Column(name = "delivery_mode", nullable = false, length = 16)
    private String deliveryMode = "TEXT";
    @Column(name = "batch_size", nullable = false)
    private int batchSize = 50;
    @Column(name = "total_count", nullable = false)
    private int totalCount;
    @Column(name = "pending_count", nullable = false)
    private int pendingCount;
    @Column(name = "sending_count", nullable = false)
    private int sendingCount;
    @Column(name = "sent_count", nullable = false)
    private int sentCount;
    @Column(name = "retry_count", nullable = false)
    private int retryCount;
    @Column(name = "failed_count", nullable = false)
    private int failedCount;
    @Column(name = "skipped_count", nullable = false)
    private int skippedCount;
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    @Column(name = "finished_at")
    private LocalDateTime finishedAt;
    @Column(name = "last_error", length = 1000)
    private String lastError;
}

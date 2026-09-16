package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrNightRewardEntitlementStatus;
import com.booking.system.hr.enums.HrNightRewardTrack;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "hr_night_reward_entitlements")
public class HrNightRewardEntitlement extends HrBaseEntity {
    @Column(name = "program_id", nullable = false, length = 36)
    private String programId;
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Enumerated(EnumType.STRING)
    @Column(name = "track_code", nullable = false, length = 32)
    private HrNightRewardTrack trackCode;
    @Column(name = "qualified_months_at_maturity", nullable = false)
    private int qualifiedMonthsAtMaturity;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private HrNightRewardEntitlementStatus status = HrNightRewardEntitlementStatus.DRAFT;
    @Column(name = "source_snapshot_json", nullable = false, columnDefinition = "JSON")
    private String sourceSnapshotJson;
}

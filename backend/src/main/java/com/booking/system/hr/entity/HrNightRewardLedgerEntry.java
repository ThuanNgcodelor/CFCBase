package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrNightRewardLedgerEntryType;
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
@Table(name = "hr_night_reward_ledger")
public class HrNightRewardLedgerEntry extends HrBaseEntity {
    @Column(name = "program_id", nullable = false, length = 36)
    private String programId;
    @Column(name = "employee_id", nullable = false, length = 36)
    private String employeeId;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "qualification_id", length = 36)
    private String qualificationId;
    @Enumerated(EnumType.STRING)
    @Column(name = "track_code", nullable = false, length = 32)
    private HrNightRewardTrack trackCode;
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 32)
    private HrNightRewardLedgerEntryType entryType;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
    @Column(nullable = false, length = 1000)
    private String reason;
}

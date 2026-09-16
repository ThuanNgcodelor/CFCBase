package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrAttendancePolicyGroup;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "hr_night_reward_programs")
public class HrNightRewardProgram extends HrBaseEntity {
    @Column(nullable = false, unique = true, length = 64)
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;
    @Column(name = "effective_to")
    private LocalDate effectiveTo;
    @Column(name = "qualifying_night_threshold", nullable = false)
    private int qualifyingNightThreshold;
    @Enumerated(EnumType.STRING)
    @Column(name = "eligible_policy_group", nullable = false, length = 32)
    private HrAttendancePolicyGroup eligiblePolicyGroup;
    @Column(nullable = false)
    private boolean active = true;
}

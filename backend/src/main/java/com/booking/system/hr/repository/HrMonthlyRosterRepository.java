package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRoster;

import java.time.LocalDate;
import java.util.Optional;

public interface HrMonthlyRosterRepository extends HrRepository<HrMonthlyRoster, String> {
    Optional<HrMonthlyRoster> findByPeriodStart(LocalDate periodStart);
}

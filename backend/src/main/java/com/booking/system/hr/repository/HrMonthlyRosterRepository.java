package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRoster;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

public interface HrMonthlyRosterRepository extends HrRepository<HrMonthlyRoster, String> {
    Optional<HrMonthlyRoster> findByPeriodStart(LocalDate periodStart);

    List<HrMonthlyRoster> findAllBySourceImportBatch_Id(String batchId);

    boolean existsBySourceRoster_Id(String sourceRosterId);
}

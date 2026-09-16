package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardLedgerEntry;
import com.booking.system.hr.enums.HrNightRewardLedgerEntryType;
import com.booking.system.hr.enums.HrNightRewardTrack;

import java.util.Collection;
import java.util.List;

public interface HrNightRewardLedgerEntryRepository extends HrRepository<HrNightRewardLedgerEntry, String> {
    List<HrNightRewardLedgerEntry> findByQualificationIdAndTrackCodeAndEntryType(
            String qualificationId, HrNightRewardTrack trackCode, HrNightRewardLedgerEntryType entryType);
    List<HrNightRewardLedgerEntry> findByProgramIdAndEmployeeIdAndTrackCodeOrderByCreatedAtAsc(
            String programId, String employeeId, HrNightRewardTrack trackCode);
    List<HrNightRewardLedgerEntry> findByQualificationId(String qualificationId);
}

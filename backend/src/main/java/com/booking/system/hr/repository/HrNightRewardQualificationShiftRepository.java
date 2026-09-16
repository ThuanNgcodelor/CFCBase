package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardQualificationShift;
import java.util.Collection;
import java.util.List;

public interface HrNightRewardQualificationShiftRepository extends HrRepository<HrNightRewardQualificationShift, String> {
    List<HrNightRewardQualificationShift> findByQualificationIdOrderByWorkDateAsc(String qualificationId);
    List<HrNightRewardQualificationShift> findBySourceImportIdIn(Collection<String> sourceImportIds);
}

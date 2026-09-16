package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardEntitlement;
import com.booking.system.hr.enums.HrNightRewardEntitlementStatus;
import com.booking.system.hr.enums.HrNightRewardTrack;

import java.util.List;

public interface HrNightRewardEntitlementRepository extends HrRepository<HrNightRewardEntitlement, String> {
    List<HrNightRewardEntitlement> findByProgramIdAndEmployeeIdAndStatus(String programId, String employeeId,
                                                                          HrNightRewardEntitlementStatus status);
    boolean existsByProgramIdAndEmployeeIdAndTrackCodeAndQualifiedMonthsAtMaturityAndStatus(
            String programId, String employeeId, HrNightRewardTrack trackCode, int qualifiedMonthsAtMaturity,
            HrNightRewardEntitlementStatus status);
}

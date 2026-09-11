package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceShiftPolicy;
import com.booking.system.hr.enums.HrAttendancePolicyGroup;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HrAttendanceShiftPolicyRepository extends HrRepository<HrAttendanceShiftPolicy, String> {
    Optional<HrAttendanceShiftPolicy> findByCode(String code);
    List<HrAttendanceShiftPolicy> findAllByOrderByPolicyGroupAscPriorityDescCodeAsc();

    @Query("""
            select policy from HrAttendanceShiftPolicy policy
            where policy.policyGroup = :group and policy.active = true
              and policy.validFrom <= :date
              and (policy.validTo is null or policy.validTo >= :date)
            order by policy.priority desc, policy.code asc
            """)
    List<HrAttendanceShiftPolicy> findEffective(@Param("group") HrAttendancePolicyGroup group,
                                                @Param("date") LocalDate date);
}

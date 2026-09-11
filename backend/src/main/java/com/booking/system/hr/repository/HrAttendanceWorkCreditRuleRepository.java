package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceWorkCreditRule;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface HrAttendanceWorkCreditRuleRepository extends HrRepository<HrAttendanceWorkCreditRule, String> {
    List<HrAttendanceWorkCreditRule> findAllByOrderByPriorityDesc();
    @Query("""
            select rule from HrAttendanceWorkCreditRule rule
            where rule.shiftPolicyId in :policyIds and rule.active = true
              and rule.validFrom <= :date
              and (rule.validTo is null or rule.validTo >= :date)
            order by rule.priority desc
            """)
    List<HrAttendanceWorkCreditRule> findEffective(@Param("policyIds") List<String> policyIds,
                                                   @Param("date") LocalDate date);
}

package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeAttendancePolicy;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface HrEmployeeAttendancePolicyRepository extends HrRepository<HrEmployeeAttendancePolicy, String> {
    List<HrEmployeeAttendancePolicy> findByEmployeeIdOrderByValidFromDesc(String employeeId);
    @Query("""
            select policy from HrEmployeeAttendancePolicy policy
            where policy.employeeId = :employeeId
              and policy.validFrom <= :date
              and (policy.validTo is null or policy.validTo >= :date)
            order by policy.validFrom desc
            """)
    List<HrEmployeeAttendancePolicy> findEffective(@Param("employeeId") String employeeId,
                                                   @Param("date") LocalDate date);

    @Query("""
            select policy from HrEmployeeAttendancePolicy policy
            where policy.employeeId = :employeeId
              and (:validTo is null or policy.validFrom <= :validTo)
              and (policy.validTo is null or policy.validTo >= :validFrom)
            """)
    List<HrEmployeeAttendancePolicy> findOverlapping(@Param("employeeId") String employeeId,
                                                     @Param("validFrom") LocalDate validFrom,
                                                     @Param("validTo") LocalDate validTo);
}

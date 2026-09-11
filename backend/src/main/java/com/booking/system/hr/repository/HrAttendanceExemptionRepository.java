package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceExemption;
import com.booking.system.hr.enums.HrAttendanceExemptionStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface HrAttendanceExemptionRepository extends HrRepository<HrAttendanceExemption, String> {
    List<HrAttendanceExemption> findByEmployeeCodeOrderByValidFromDesc(String employeeCode);
    @Query("""
            select exemption from HrAttendanceExemption exemption
            where exemption.employeeCode in :codes and exemption.status = :status
              and exemption.validFrom <= :toDate and exemption.validTo >= :fromDate
            """)
    List<HrAttendanceExemption> findEffective(@Param("codes") List<String> codes,
                                              @Param("status") HrAttendanceExemptionStatus status,
                                              @Param("fromDate") LocalDate fromDate,
                                              @Param("toDate") LocalDate toDate);
}

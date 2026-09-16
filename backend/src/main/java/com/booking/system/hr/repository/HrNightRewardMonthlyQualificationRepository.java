package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardMonthlyQualification;
import com.booking.system.hr.enums.HrNightRewardMonthlyStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrNightRewardMonthlyQualificationRepository extends HrRepository<HrNightRewardMonthlyQualification, String> {
    Optional<HrNightRewardMonthlyQualification> findFirstByProgramIdAndEmployeeIdAndAttendanceMonthOrderByRevisionDesc(
            String programId, String employeeId, String attendanceMonth);
    List<HrNightRewardMonthlyQualification> findByProgramIdAndAttendanceMonthOrderByEmployeeCodeAscRevisionDesc(
            String programId, String attendanceMonth);
    List<HrNightRewardMonthlyQualification> findByProgramIdAndEmployeeIdOrderByAttendanceMonthAscRevisionAsc(
            String programId, String employeeId);
    Page<HrNightRewardMonthlyQualification> findByProgramIdAndAttendanceMonthOrderByEmployeeCodeAscRevisionDesc(
            String programId, String attendanceMonth, Pageable pageable);
    @Query("""
            select value from HrNightRewardMonthlyQualification value
            where value.programId = :programId and value.employeeId in :employeeIds
              and value.status <> :stale
            order by value.employeeId, value.attendanceMonth, value.revision
            """)
    List<HrNightRewardMonthlyQualification> findCurrentForEmployees(@Param("programId") String programId,
                                                                     @Param("employeeIds") Collection<String> employeeIds,
                                                                     @Param("stale") HrNightRewardMonthlyStatus stale);
}

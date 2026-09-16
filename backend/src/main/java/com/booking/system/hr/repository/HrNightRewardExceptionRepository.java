package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardException;
import com.booking.system.hr.enums.HrNightRewardExceptionStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrNightRewardExceptionRepository extends HrRepository<HrNightRewardException, String> {
    List<HrNightRewardException> findByProgramIdAndAttendanceMonthOrderByCreatedAtDesc(String programId, String attendanceMonth);
    Optional<HrNightRewardException> findFirstByProgramIdAndEmployeeIdAndAttendanceMonthAndStatusOrderByCreatedAtDesc(
            String programId, String employeeId, String attendanceMonth, HrNightRewardExceptionStatus status);
    List<HrNightRewardException> findByProgramIdAndEmployeeIdInAndAttendanceMonthOrderByCreatedAtDesc(
            String programId, Collection<String> employeeIds, String attendanceMonth);
}

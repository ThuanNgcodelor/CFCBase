package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceSourceDay;

import java.util.List;

public interface HrAttendanceSourceDayRepository extends HrRepository<HrAttendanceSourceDay, String> {
    List<HrAttendanceSourceDay> findByImportIdOrderByEmployeeCodeAscWorkDateAsc(String importId);
    boolean existsByImportIdAndEmployeeCodeIn(String importId, List<String> employeeCodes);
}

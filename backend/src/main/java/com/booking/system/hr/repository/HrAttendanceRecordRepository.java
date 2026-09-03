package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceRecord;
import com.booking.system.hr.enums.HrAttendanceRecordStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface HrAttendanceRecordRepository extends HrRepository<HrAttendanceRecord, String> {
    Page<HrAttendanceRecord> findByImportIdOrderBySourceRowNumber(String importId, Pageable pageable);
    List<HrAttendanceRecord> findByImportIdOrderBySourceRowNumber(String importId);
    long countByImportIdAndStatus(String importId, HrAttendanceRecordStatus status);
}

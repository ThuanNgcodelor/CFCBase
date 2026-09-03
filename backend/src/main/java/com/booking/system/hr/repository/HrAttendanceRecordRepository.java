package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrAttendanceRecordRepository extends HrRepository<HrAttendanceRecord, String> {
    Page<HrAttendanceRecord> findByImportIdOrderBySourceRowNumber(String importId, Pageable pageable);
}

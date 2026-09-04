package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceImport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.booking.system.hr.enums.HrAttendanceImportStatus;
import java.util.List;
import java.util.Optional;

public interface HrAttendanceImportRepository extends HrRepository<HrAttendanceImport, String> {
    Optional<HrAttendanceImport> findByFileSha256(String fileSha256);
    Page<HrAttendanceImport> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<HrAttendanceImport> findAllByAttendanceMonthOrderByCreatedAtDesc(String attendanceMonth, Pageable pageable);
    List<HrAttendanceImport> findAllByAttendanceMonthAndStatusOrderByCreatedAtAsc(String attendanceMonth, HrAttendanceImportStatus status);
    void deleteById(String id);
}

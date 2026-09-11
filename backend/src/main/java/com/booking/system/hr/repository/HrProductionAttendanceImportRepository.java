package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrProductionAttendanceImport;
import com.booking.system.hr.enums.HrAttendanceImportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface HrProductionAttendanceImportRepository extends HrRepository<HrProductionAttendanceImport, String> {
    Optional<HrProductionAttendanceImport> findByFileSha256(String fileSha256);
    Page<HrProductionAttendanceImport> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<HrProductionAttendanceImport> findByAttendanceMonthOrderByCreatedAtDesc(String month, Pageable pageable);
    List<HrProductionAttendanceImport> findByAttendanceMonthAndStatusOrderByCreatedAtAsc(
            String month, HrAttendanceImportStatus status);
}

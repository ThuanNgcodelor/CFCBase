package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceImport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface HrAttendanceImportRepository extends HrRepository<HrAttendanceImport, String> {
    Optional<HrAttendanceImport> findByFileSha256(String fileSha256);
    Page<HrAttendanceImport> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

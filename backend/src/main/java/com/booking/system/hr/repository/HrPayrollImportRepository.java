package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollImport;
import com.booking.system.hr.enums.HrPayrollImportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface HrPayrollImportRepository extends HrRepository<HrPayrollImport, String> {
    Optional<HrPayrollImport> findByFileSha256(String fileSha256);
    Page<HrPayrollImport> findAllByOrderByCreatedAtDesc(Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payrollImport from HrPayrollImport payrollImport where payrollImport.id = :id")
    Optional<HrPayrollImport> findByIdForUpdate(@Param("id") String id);
    long countByStatus(HrPayrollImportStatus status);
}

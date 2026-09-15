package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollImportRow;
import com.booking.system.hr.enums.HrPayrollRowStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrPayrollImportRowRepository extends HrRepository<HrPayrollImportRow, String> {
    @EntityGraph(attributePaths = {"employee"})
    Page<HrPayrollImportRow> findByPayrollImportIdOrderBySourceRowNumber(String importId, Pageable pageable);
    @EntityGraph(attributePaths = {"employee"})
    List<HrPayrollImportRow> findByPayrollImportIdOrderBySourceRowNumber(String importId);
    List<HrPayrollImportRow> findByPayrollImportIdAndStatusIn(String importId, Collection<HrPayrollRowStatus> statuses);
    long countByPayrollImportIdAndStatus(String importId, HrPayrollRowStatus status);
    @EntityGraph(attributePaths = {"employee", "payrollImport"})
    Optional<HrPayrollImportRow> findByIdAndPayrollImportId(String id, String importId);
    @EntityGraph(attributePaths = {"employee"})
    @Query("""
            select row from HrPayrollImportRow row
            where row.payrollImport.id = :importId
              and (:status is null or row.status = :status)
              and (:keyword is null or lower(row.employeeCode) like :keyword or lower(row.employeeName) like :keyword)
            order by row.sourceRowNumber
            """)
    Page<HrPayrollImportRow> search(@Param("importId") String importId,
                                    @Param("status") HrPayrollRowStatus status,
                                    @Param("keyword") String keyword,
                                    Pageable pageable);
}

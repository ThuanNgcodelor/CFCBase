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

public interface HrPayrollImportRowRepository extends HrRepository<HrPayrollImportRow, String> {
    @EntityGraph(attributePaths = {"employee"})
    Page<HrPayrollImportRow> findByPayrollImportIdOrderBySourceRowNumber(String importId, Pageable pageable);
    @EntityGraph(attributePaths = {"employee"})
    List<HrPayrollImportRow> findByPayrollImportIdOrderBySourceRowNumber(String importId);
    List<HrPayrollImportRow> findByPayrollImportIdAndStatusIn(String importId, Collection<HrPayrollRowStatus> statuses);
    long countByPayrollImportIdAndStatus(String importId, HrPayrollRowStatus status);
}

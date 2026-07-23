package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrExcelImportRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface HrExcelImportRowRepository extends HrRepository<HrExcelImportRow, String> {
    Page<HrExcelImportRow> findByBatch_IdOrderByRowNumber(String batchId, Pageable pageable);

    List<HrExcelImportRow> findAllByBatch_IdOrderByRowNumber(String batchId);

    long countByEmployee_Id(String employeeId);

    long countByMovement_Id(String movementId);
}

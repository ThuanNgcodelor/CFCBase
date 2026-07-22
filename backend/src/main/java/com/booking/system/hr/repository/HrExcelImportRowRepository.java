package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrExcelImportRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrExcelImportRowRepository extends HrRepository<HrExcelImportRow, String> {
    Page<HrExcelImportRow> findByBatch_IdOrderByRowNumber(String batchId, Pageable pageable);
}

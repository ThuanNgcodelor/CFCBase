package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface HrExcelImportBatchRepository extends HrRepository<HrExcelImportBatch, String> {
    Page<HrExcelImportBatch> findByStatus(HrImportBatchStatus status, Pageable pageable);

    Optional<HrExcelImportBatch> findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
            String fileSha256,
            String sourceSheetName,
            HrImportType importType
    );
}

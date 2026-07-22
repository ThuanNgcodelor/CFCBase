package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Collection;

import java.util.Optional;

public interface HrExcelImportBatchRepository extends HrRepository<HrExcelImportBatch, String> {
    Page<HrExcelImportBatch> findByStatus(HrImportBatchStatus status, Pageable pageable);

    Optional<HrExcelImportBatch> findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
            String fileSha256,
            String sourceSheetName,
            HrImportType importType
    );

    Optional<HrExcelImportBatch> findByConfirmationKey(String confirmationKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select batch from HrExcelImportBatch batch where batch.id = :id")
    Optional<HrExcelImportBatch> findLockedById(String id);

    Page<HrExcelImportBatch> findByPayloadPurgedAtIsNullAndPayloadRetentionUntilLessThanEqualAndStatusIn(
            LocalDateTime now,
            Collection<HrImportBatchStatus> statuses,
            Pageable pageable
    );
}

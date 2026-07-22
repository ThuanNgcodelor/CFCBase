package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportType;

import java.time.LocalDateTime;

public record HrImportBatchResponse(
        String batchId,
        HrImportType importType,
        String sourceFileName,
        String sourceSheetName,
        int attemptNumber,
        Short sourcePeriodYear,
        Byte sourcePeriodMonth,
        HrImportBatchStatus status,
        int totalRows,
        int validRows,
        int warningRows,
        int invalidRows,
        int importedRows,
        LocalDateTime parsedAt,
        LocalDateTime validatedAt,
        LocalDateTime confirmedAt,
        LocalDateTime rolledBackAt,
        LocalDateTime payloadRetentionUntil,
        LocalDateTime payloadPurgedAt,
        LocalDateTime createdAt,
        String createdByActor,
        long rowVersion
) {
    public static HrImportBatchResponse from(HrExcelImportBatch batch) {
        return new HrImportBatchResponse(
                batch.getId(),
                batch.getImportType(),
                batch.getSourceFileName(),
                batch.getSourceSheetName(),
                batch.getAttemptNumber(),
                batch.getSourcePeriodYear(),
                batch.getSourcePeriodMonth(),
                batch.getStatus(),
                batch.getTotalRows(),
                batch.getValidRows(),
                batch.getWarningRows(),
                batch.getInvalidRows(),
                batch.getImportedRows(),
                batch.getParsedAt(),
                batch.getValidatedAt(),
                batch.getConfirmedAt(),
                batch.getRolledBackAt(),
                batch.getPayloadRetentionUntil(),
                batch.getPayloadPurgedAt(),
                batch.getCreatedAt(),
                batch.getCreatedByActor(),
                batch.getRowVersion()
        );
    }
}

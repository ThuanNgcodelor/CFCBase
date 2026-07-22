package com.booking.system.hr.importer;

import com.booking.system.hr.enums.HrImportBatchStatus;

import java.time.LocalDateTime;

public record HrImportBatchSummary(
        String batchId,
        HrImportBatchStatus status,
        int attemptNumber,
        int totalRows,
        int validRows,
        int warningRows,
        int invalidRows,
        int importedRows,
        String fileSha256,
        LocalDateTime parsedAt,
        LocalDateTime validatedAt,
        LocalDateTime confirmedAt,
        LocalDateTime rolledBackAt,
        LocalDateTime payloadRetentionUntil,
        LocalDateTime payloadPurgedAt
) {
}

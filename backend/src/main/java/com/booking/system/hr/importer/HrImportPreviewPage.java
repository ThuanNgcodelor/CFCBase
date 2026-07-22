package com.booking.system.hr.importer;

import java.util.List;

public record HrImportPreviewPage(
        HrImportBatchSummary batch,
        List<HrImportPreviewRow> rows,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public HrImportPreviewPage {
        rows = List.copyOf(rows);
    }
}

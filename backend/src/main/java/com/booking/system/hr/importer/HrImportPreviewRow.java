package com.booking.system.hr.importer;

import com.booking.system.hr.enums.HrImportRowStatus;

import java.util.List;

public record HrImportPreviewRow(
        int sourceRowNumber,
        HrImportRowStatus status,
        HrBaselineRowData data,
        List<HrImportIssue> issues
) {
    public HrImportPreviewRow {
        issues = List.copyOf(issues);
    }
}

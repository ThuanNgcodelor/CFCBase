package com.booking.system.hr.importer;

import java.util.List;

public record HrWorkforceSnapshotPreview(
        String sourceFileName,
        String fileSha256,
        int currentTotalEmployees,
        int currentActiveEmployees,
        int targetActiveEmployees,
        int increaseCount,
        int decreaseCount,
        int profileUpdateCount,
        int warningRows,
        boolean bootstrap,
        boolean applicable,
        List<HrWorkforceSnapshotChange> increases,
        List<HrWorkforceSnapshotChange> decreases,
        List<String> blockingIssues,
        List<String> warnings
) {
    public HrWorkforceSnapshotPreview {
        increases = List.copyOf(increases);
        decreases = List.copyOf(decreases);
        blockingIssues = List.copyOf(blockingIssues);
        warnings = List.copyOf(warnings);
    }
}

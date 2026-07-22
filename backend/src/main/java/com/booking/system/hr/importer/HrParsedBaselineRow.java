package com.booking.system.hr.importer;

import java.util.List;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record HrParsedBaselineRow(
        int sourceRowNumber,
        Map<String, HrRawCell> rawCells,
        HrBaselineRowData normalizedData,
        List<HrImportIssue> issues
) {
    public HrParsedBaselineRow {
        rawCells = Collections.unmodifiableMap(new LinkedHashMap<>(rawCells));
        issues = List.copyOf(issues);
    }
}

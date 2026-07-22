package com.booking.system.hr.importer;

import java.time.LocalDate;
import java.util.List;

public record HrParsedBaselineWorkbook(
        String fileSha256,
        long fileSize,
        String sourceSheetName,
        LocalDate periodStart,
        List<HrParsedBaselineRow> rows
) {
    public HrParsedBaselineWorkbook {
        rows = List.copyOf(rows);
    }
}

package com.booking.system.hr.importer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class HrBaselineImportContract {

    public static final String LOCKED_SHA256 = "d8f4ff9e292b68d1ec50b623159ef34095f7441d3487fa1e422140f0fdeaadbe";
    public static final String TEMPLATE_KEY = "HR_BASELINE_2026";
    public static final String VERSION_CODE = "2026-06-PHASE-0.1";
    public static final String LOCKED_FILE_NAME = "baseline-values-2026.xlsx";

    private final String expectedSha256;

    public HrBaselineImportContract(
            @Value("${app.hr.baseline.sha256:" + LOCKED_SHA256 + "}") String expectedSha256
    ) {
        this.expectedSha256 = normalizeSha(expectedSha256);
    }

    public String expectedSha256() {
        return expectedSha256;
    }

    public LocalDate periodStart() {
        return HrBaselineWorkbookParser.PERIOD_START;
    }

    public void verify(HrParsedBaselineWorkbook workbook) {
        if (!expectedSha256.equals(workbook.fileSha256())) {
            throw new HrBaselineImportException(
                    "BASELINE_CHECKSUM_MISMATCH",
                    "File upload không khớp checksum baseline Phase 0.1 đã khóa."
            );
        }
        if (!HrBaselineWorkbookParser.SOURCE_SHEET.equals(workbook.sourceSheetName())
                || !periodStart().equals(workbook.periodStart())
                || workbook.rows().size() != HrBaselineWorkbookParser.EXPECTED_DATA_ROWS) {
            throw new HrBaselineImportException(
                    "BASELINE_CONTRACT_MISMATCH",
                    "File upload không khớp kỳ hoặc số dòng baseline đã khóa."
            );
        }
    }

    private static String normalizeSha(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("HR baseline SHA-256 must contain exactly 64 hexadecimal characters");
        }
        return normalized;
    }
}

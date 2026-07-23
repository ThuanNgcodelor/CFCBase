package com.booking.system.hr.importer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class HrWorkforceSnapshotContract {

    public static final String LOCKED_SHA256 =
            "e35f22c83f5dacb542c7b3cff76238fcbaf8ac22f7e85b786d62d2c1de6cf6f7";
    public static final String LOCKED_FILE_NAME = "workforce-baseline-339-2026.xlsx";
    public static final int EXPECTED_TARGET_ACTIVE = 339;

    private final String expectedSha256;

    public HrWorkforceSnapshotContract(
            @Value("${app.hr.workforce-snapshot.sha256:" + LOCKED_SHA256 + "}") String expectedSha256
    ) {
        this.expectedSha256 = normalizeSha(expectedSha256);
    }

    public String expectedSha256() {
        return expectedSha256;
    }

    public void verify(HrParsedBaselineWorkbook workbook) {
        if (!expectedSha256.equals(workbook.fileSha256())) {
            throw new HrBaselineImportException(
                    "WORKFORCE_SNAPSHOT_CHECKSUM_MISMATCH",
                    "File không khớp artifact baseline T6-26 gồm 339 nhân sự đã khóa."
            );
        }
        if (!HrBaselineWorkbookParser.WORKFORCE_BASELINE_SHEET.equals(workbook.sourceSheetName())
                || !HrBaselineWorkbookParser.WORKFORCE_BASELINE_PERIOD_START.equals(workbook.periodStart())
                || workbook.rows().size() != HrBaselineWorkbookParser.WORKFORCE_SNAPSHOT_EXPECTED_DATA_ROWS) {
            throw new HrBaselineImportException(
                    "WORKFORCE_SNAPSHOT_CONTRACT_MISMATCH",
                    "File không đúng kỳ T6-26 hoặc không đủ 339 dòng nhân sự."
            );
        }
    }

    private static String normalizeSha(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(
                    "HR workforce snapshot SHA-256 must contain exactly 64 hexadecimal characters"
            );
        }
        return normalized;
    }
}

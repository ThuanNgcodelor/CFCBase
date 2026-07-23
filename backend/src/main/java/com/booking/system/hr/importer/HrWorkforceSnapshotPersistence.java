package com.booking.system.hr.importer;

import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportType;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrExcelImportBatchRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * One-time bootstrap for the corrected historical June 2026 roster.
 *
 * <p>The original 329 -> 339 transition was based on an incorrect June
 * aggregate. The authoritative import is now a single baseline: T6-26 has
 * exactly 339 active employees. Persistence is delegated to the hardened
 * baseline importer so employees, aggregate records, INITIAL_LOAD movements,
 * import rows and the immutable roster are created in one transaction.</p>
 */
@Service
@RequiredArgsConstructor
public class HrWorkforceSnapshotPersistence {

    private final HrBaselineImportPersistence baselineImportPersistence;
    private final HrExcelImportBatchRepository batchRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeMovementRepository movementRepository;
    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public HrWorkforceSnapshotPreview preview(
            String originalFileName,
            HrParsedBaselineWorkbook workbook
    ) {
        return plan(originalFileName, workbook, employeeRepository.findAllDetails()).preview();
    }

    @Transactional
    public HrWorkforceSnapshotResult confirm(
            String originalFileName,
            HrParsedBaselineWorkbook workbook,
            String confirmationKey,
            int expectedActiveEmployees,
            HrImportActor actor
    ) {
        String safeConfirmationKey = confirmationKey(confirmationKey);
        if (expectedActiveEmployees != HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE) {
            throw failure(
                    "WORKFORCE_SNAPSHOT_CONFIRMATION_MISMATCH",
                    "Số nhân sự xác nhận phải là 339."
            );
        }

        HrExcelImportBatch existing = batchRepository
                .findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
                        workbook.fileSha256(),
                        workbook.sourceSheetName(),
                        HrImportType.BASELINE
                )
                .orElse(null);
        if (existing != null && existing.getStatus() == HrImportBatchStatus.CONFIRMED) {
            if (!safeConfirmationKey.equals(existing.getConfirmationKey())) {
                throw failure(
                        "WORKFORCE_SNAPSHOT_ALREADY_APPLIED",
                        "Baseline T6-26 gồm 339 nhân sự đã được xác nhận bằng confirmation key khác."
                );
            }
            verifyConfirmedState(existing);
            return replayResult(existing);
        }

        SnapshotPlan plan = plan(
                originalFileName,
                workbook,
                employeeRepository.findAllDetailsForUpdate()
        );
        if (!plan.applicable()) {
            throw failure("WORKFORCE_SNAPSHOT_NOT_APPLICABLE", plan.blockingIssues().getFirst());
        }

        HrImportBatchSummary staged = baselineImportPersistence.stageLockedWorkforceBaseline(
                originalFileName,
                workbook,
                actor
        );
        HrImportBatchSummary validated = baselineImportPersistence.validate(staged.batchId(), actor);
        if (validated.invalidRows() > 0) {
            throw failure(
                    "WORKFORCE_SNAPSHOT_VALIDATION_FAILED",
                    "File baseline T6-26 còn dòng dữ liệu không hợp lệ."
            );
        }
        HrImportBatchSummary confirmed = baselineImportPersistence.confirm(
                staged.batchId(),
                safeConfirmationKey,
                true,
                actor
        );
        entityManager.flush();

        HrExcelImportBatch batch = batchRepository.findById(confirmed.batchId())
                .orElseThrow(() -> failure("WORKFORCE_SNAPSHOT_BATCH_MISSING", "Không tìm thấy batch vừa import."));
        verifyConfirmedState(batch);
        return new HrWorkforceSnapshotResult(
                batch.getId(),
                batch.getFileSha256(),
                0,
                0,
                0,
                HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE,
                HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE,
                true,
                false
        );
    }

    private SnapshotPlan plan(
            String originalFileName,
            HrParsedBaselineWorkbook workbook,
            List<HrEmployee> existingEmployees
    ) {
        List<String> blockingIssues = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        batchRepository
                .findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
                        workbook.fileSha256(),
                        workbook.sourceSheetName(),
                        HrImportType.BASELINE
                )
                .filter(batch -> batch.getStatus() == HrImportBatchStatus.CONFIRMED)
                .ifPresent(batch -> blockingIssues.add(
                        "Baseline T6-26 gồm 339 nhân sự đã được xác nhận trước đó."
                ));

        long errorRows = workbook.rows().stream()
                .filter(row -> row.issues().stream()
                        .anyMatch(issue -> issue.severity() == HrImportIssueSeverity.ERROR))
                .count();
        int warningRows = (int) workbook.rows().stream()
                .filter(row -> row.issues().stream()
                        .anyMatch(issue -> issue.severity() == HrImportIssueSeverity.WARNING))
                .count();
        if (errorRows > 0) {
            blockingIssues.add("File còn " + errorRows + " dòng dữ liệu không hợp lệ.");
        }

        Set<String> employeeCodes = new HashSet<>();
        for (HrParsedBaselineRow row : workbook.rows()) {
            String code = canonicalKey(row.normalizedData().employeeCode());
            if (!employeeCodes.add(code)) {
                blockingIssues.add("File có mã nhân viên trùng: " + row.normalizedData().employeeCode());
            }
        }
        if (employeeCodes.size() != HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE) {
            blockingIssues.add("File phải có đúng 339 mã nhân viên duy nhất.");
        }

        boolean emptyHrDomain = existingEmployees.isEmpty()
                && rosterRepository.findFirstByOrderByPeriodStartDesc().isEmpty();
        if (!emptyHrDomain) {
            blockingIssues.add(
                    "HR đã có dữ liệu. Baseline T6-26 = 339 chỉ được import một lần khi miền HR trống hoàn toàn."
            );
        }
        if (movementRepository.existsByStatus(com.booking.system.hr.enums.HrMovementStatus.DRAFT)) {
            blockingIssues.add("Đang có biến động nhân sự nháp; cần xử lý trước khi import baseline.");
        }

        if (warningRows > 0) {
            warnings.add("File có " + warningRows + " dòng cần rà soát sau khi nhập.");
        }
        warnings.add("Import sẽ tạo một roster T6-26 đã chốt gồm đúng 339 nhân sự đang hoạt động.");
        warnings.add("G083 đang để trống CCCD vì số trong file nguồn bị lặp; cần xác minh giấy tờ gốc sau import.");

        return new SnapshotPlan(
                safeFileName(originalFileName),
                workbook,
                existingEmployees.size(),
                (int) existingEmployees.stream()
                        .filter(employee -> employee.getEmploymentStatus() == HrEmploymentStatus.ACTIVE)
                        .count(),
                warningRows,
                emptyHrDomain,
                List.copyOf(blockingIssues),
                List.copyOf(warnings)
        );
    }

    private void verifyConfirmedState(HrExcelImportBatch batch) {
        HrMonthlyRoster roster = rosterRepository.findByPeriodStart(HrBaselineWorkbookParser.PERIOD_START)
                .orElseThrow(() -> failure(
                        "WORKFORCE_SNAPSHOT_HISTORY_INCONSISTENT",
                        "Baseline đã xác nhận nhưng thiếu roster T6-26."
                ));
        boolean valid = employeeRepository.countByEmploymentStatus(HrEmploymentStatus.ACTIVE)
                == HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE
                && employeeRepository.count() == HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE
                && roster.getStatus() == HrRosterStatus.CLOSED
                && roster.getSourceImportBatch() != null
                && batch.getId().equals(roster.getSourceImportBatch().getId())
                && rosterItemRepository.countByRoster_Id(roster.getId())
                == HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE
                && movementRepository.findAllByImportBatch_Id(batch.getId()).size()
                == HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE;
        if (!valid) {
            throw failure(
                    "WORKFORCE_SNAPSHOT_HISTORY_INCONSISTENT",
                    "Baseline 339 đã xác nhận nhưng dữ liệu HR hiện tại không còn đầy đủ; không tự phát lại."
            );
        }
    }

    private static HrWorkforceSnapshotResult replayResult(HrExcelImportBatch batch) {
        return new HrWorkforceSnapshotResult(
                batch.getId(),
                batch.getFileSha256(),
                0,
                0,
                0,
                HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE,
                HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE,
                true,
                true
        );
    }

    private static String canonicalKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String safeFileName(String value) {
        String candidate = value == null ? "" : value.replace('\\', '/');
        candidate = candidate.substring(candidate.lastIndexOf('/') + 1).trim();
        return candidate.isEmpty() ? HrWorkforceSnapshotContract.LOCKED_FILE_NAME : candidate;
    }

    private static String confirmationKey(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw failure(
                    "CONFIRMATION_KEY_INVALID",
                    "Confirmation key phải có từ 1 đến 100 ký tự."
            );
        }
        return normalized;
    }

    private static HrBaselineImportException failure(String code, String message) {
        return new HrBaselineImportException(code, message);
    }

    private record SnapshotPlan(
            String sourceFileName,
            HrParsedBaselineWorkbook workbook,
            int currentTotalEmployees,
            int currentActiveEmployees,
            int warningRows,
            boolean bootstrap,
            List<String> blockingIssues,
            List<String> warnings
    ) {
        private boolean applicable() {
            return blockingIssues.isEmpty();
        }

        private HrWorkforceSnapshotPreview preview() {
            return new HrWorkforceSnapshotPreview(
                    sourceFileName,
                    workbook.fileSha256(),
                    currentTotalEmployees,
                    currentActiveEmployees,
                    HrWorkforceSnapshotContract.EXPECTED_TARGET_ACTIVE,
                    0,
                    0,
                    0,
                    warningRows,
                    bootstrap,
                    applicable(),
                    List.of(),
                    List.of(),
                    blockingIssues,
                    warnings
            );
        }
    }
}

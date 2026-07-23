package com.booking.system.hr.importer;

import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrAuditable;
import com.booking.system.hr.entity.HrDepartment;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeContact;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeIdentity;
import com.booking.system.hr.entity.HrEmployeeInsurance;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.entity.HrExcelImportRow;
import com.booking.system.hr.entity.HrExcelTemplateVersion;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.entity.HrMonthlyRosterItem;
import com.booking.system.hr.entity.HrPosition;
import com.booking.system.hr.entity.HrWorkingCondition;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrIdentityVerificationStatus;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportRowStatus;
import com.booking.system.hr.enums.HrImportType;
import com.booking.system.hr.enums.HrInsuranceStatus;
import com.booking.system.hr.enums.HrMovementSourceKind;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.enums.HrRosterInclusionReason;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.enums.HrTemplateStatus;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrDepartmentRepository;
import com.booking.system.hr.repository.HrEmployeeContactRepository;
import com.booking.system.hr.repository.HrEmployeeEmploymentRepository;
import com.booking.system.hr.repository.HrEmployeeIdentityRepository;
import com.booking.system.hr.repository.HrEmployeeInsuranceRepository;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrExcelImportBatchRepository;
import com.booking.system.hr.repository.HrExcelImportRowRepository;
import com.booking.system.hr.repository.HrExcelTemplateVersionRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.hr.repository.HrPositionRepository;
import com.booking.system.hr.repository.HrWorkingConditionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HrBaselineImportPersistence {

    private static final TypeReference<List<HrImportIssue>> ISSUE_LIST_TYPE = new TypeReference<>() {
    };
    private static final Set<HrImportBatchStatus> PURGEABLE_STATUSES = EnumSet.of(
            HrImportBatchStatus.PARSED,
            HrImportBatchStatus.VALIDATED,
            HrImportBatchStatus.CONFIRMED,
            HrImportBatchStatus.ROLLED_BACK,
            HrImportBatchStatus.FAILED
    );

    private final HrExcelTemplateVersionRepository templateRepository;
    private final HrExcelImportBatchRepository batchRepository;
    private final HrExcelImportRowRepository rowRepository;
    private final HrDepartmentRepository departmentRepository;
    private final HrPositionRepository positionRepository;
    private final HrWorkingConditionRepository workingConditionRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeEmploymentRepository employmentRepository;
    private final HrEmployeeIdentityRepository identityRepository;
    private final HrEmployeeInsuranceRepository insuranceRepository;
    private final HrEmployeeContactRepository contactRepository;
    private final HrEmployeeMovementRepository movementRepository;
    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final HrBaselineImportContract baselineContract;
    private final EntityManager entityManager;

    @Value("${app.hr.import.payload-retention-days:30}")
    private int payloadRetentionDays;

    @Transactional
    public HrImportBatchSummary stage(
            String originalFileName,
            HrParsedBaselineWorkbook workbook,
            HrImportActor actor
    ) {
        return stage(originalFileName, workbook, actor, false);
    }

    /**
     * Stages the corrected, checksum-locked June 2026 baseline separately
     * from the historical 329-row Phase 0.1 template. Both share the same
     * field mapping, but their row contract and artifact checksum differ.
     */
    @Transactional
    public HrImportBatchSummary stageLockedWorkforceBaseline(
            String originalFileName,
            HrParsedBaselineWorkbook workbook,
            HrImportActor actor
    ) {
        return stage(originalFileName, workbook, actor, true);
    }

    private HrImportBatchSummary stage(
            String originalFileName,
            HrParsedBaselineWorkbook workbook,
            HrImportActor actor,
            boolean workforceBaseline
    ) {
        validateRetentionConfiguration();
        var latest = batchRepository
                .findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
                        workbook.fileSha256(), workbook.sourceSheetName(), HrImportType.BASELINE
                );
        if (latest.isPresent()
                && latest.get().getStatus() != HrImportBatchStatus.FAILED
                && latest.get().getStatus() != HrImportBatchStatus.ROLLED_BACK) {
            return summary(latest.get());
        }

        int attemptNumber = latest.map(batch -> batch.getAttemptNumber() + 1).orElse(1);
        HrExcelTemplateVersion template = workforceBaseline
                ? findOrCreateWorkforceBaselineTemplate(actor)
                : findOrCreateTemplate(actor);
        LocalDateTime now = nowUtc();

        HrExcelImportBatch batch = new HrExcelImportBatch();
        batch.setTemplateVersion(template);
        batch.setImportType(HrImportType.BASELINE);
        batch.setSourceFileName(safeFileName(originalFileName));
        batch.setFileSha256(workbook.fileSha256());
        batch.setFileSize(workbook.fileSize());
        batch.setStorageKey(null);
        batch.setSourceSheetName(workbook.sourceSheetName());
        batch.setAttemptNumber(attemptNumber);
        batch.setSourcePeriodYear((short) workbook.periodStart().getYear());
        batch.setSourcePeriodMonth((byte) workbook.periodStart().getMonthValue());
        batch.setStatus(HrImportBatchStatus.PARSED);
        batch.setTotalRows(workbook.rows().size());
        batch.setParsedAt(now);
        // The deadline starts at upload as well, so an abandoned preview or
        // validation batch cannot retain raw personnel data indefinitely.
        batch.setPayloadRetentionUntil(now.plusDays(payloadRetentionDays));
        auditFields(batch, actor);
        batch = batchRepository.save(batch);

        List<HrExcelImportRow> stagingRows = new ArrayList<>(workbook.rows().size());
        for (HrParsedBaselineRow parsedRow : workbook.rows()) {
            String rawJson = json(parsedRow.rawCells());
            HrExcelImportRow row = new HrExcelImportRow();
            row.setBatch(batch);
            row.setSheetName(workbook.sourceSheetName());
            row.setRowNumber(parsedRow.sourceRowNumber());
            row.setEmployeeCodeHint(parsedRow.normalizedData().employeeCode());
            row.setRowStatus(HrImportRowStatus.PENDING);
            row.setRawPayload(rawJson);
            row.setNormalizedPayload(json(parsedRow.normalizedData()));
            row.setPayloadSha256(sha256(rawJson));
            row.setIssueCodes(json(parsedRow.issues()));
            stagingRows.add(row);
        }
        rowRepository.saveAll(stagingRows);
        audit(actor, "BASELINE_IMPORT_PARSED", "HR_IMPORT_BATCH", batch.getId(), null,
                Map.of("rowCount", workbook.rows().size(), "attemptNumber", attemptNumber));
        return summary(batch);
    }

    @Transactional
    public HrImportBatchSummary validate(String batchId, HrImportActor actor) {
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireBaselineType(batch);
        if (batch.getStatus() == HrImportBatchStatus.VALIDATED
                || batch.getStatus() == HrImportBatchStatus.CONFIRMED) {
            return summary(batch);
        }
        requireStatus(batch, HrImportBatchStatus.PARSED, "BATCH_NOT_PARSED");

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        if (rows.size() != batch.getTotalRows()) {
            throw failure("STAGING_ROW_COUNT_MISMATCH", "Số dòng staging không khớp batch.");
        }

        Map<HrExcelImportRow, HrBaselineRowData> dataByRow = new LinkedHashMap<>();
        Map<HrExcelImportRow, List<HrImportIssue>> issuesByRow = new LinkedHashMap<>();
        for (HrExcelImportRow row : rows) {
            dataByRow.put(row, read(row.getNormalizedPayload(), HrBaselineRowData.class));
            issuesByRow.put(row, new ArrayList<>(issues(row.getIssueCodes())));
        }

        addDuplicateIssues(dataByRow, issuesByRow, HrBaselineRowData::employeeCode,
                HrImportIssueCode.DUPLICATE_EMPLOYEE_CODE, HrImportIssueSeverity.ERROR,
                "employeeCode", 2, "Mã nhân viên bị trùng trong file import.");
        addDuplicateIssues(dataByRow, issuesByRow, HrBaselineRowData::socialInsuranceNumber,
                HrImportIssueCode.DUPLICATE_SOCIAL_INSURANCE_NUMBER, HrImportIssueSeverity.WARNING,
                "socialInsuranceNumber", 3, "Số BHXH bị trùng; cần xác minh trước khi sử dụng.");
        addDuplicateIssues(dataByRow, issuesByRow, HrBaselineRowData::legacyIdentityNumber,
                HrImportIssueCode.DUPLICATE_LEGACY_IDENTITY_NUMBER, HrImportIssueSeverity.WARNING,
                "legacyIdentityNumber", 19, "Số CMND bị trùng; cần xác minh trước khi sử dụng.");

        List<String> employeeCodes = dataByRow.values().stream()
                .map(HrBaselineRowData::employeeCode)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<String> existingCodes = employeeRepository.findAllByEmployeeCodeIn(employeeCodes).stream()
                .map(employee -> canonicalKey(employee.getEmployeeCode()))
                .collect(Collectors.toSet());
        for (Map.Entry<HrExcelImportRow, HrBaselineRowData> entry : dataByRow.entrySet()) {
            HrBaselineRowData data = entry.getValue();
            if (data.employeeCode() != null && existingCodes.contains(canonicalKey(data.employeeCode()))) {
                issuesByRow.get(entry.getKey()).add(new HrImportIssue(
                        HrImportIssueCode.EMPLOYEE_CODE_ALREADY_EXISTS,
                        HrImportIssueSeverity.ERROR,
                        "C" + data.sourceRowNumber(),
                        "employeeCode",
                        "Mã nhân viên đã tồn tại trong HR domain."
                ));
            }
            if (data.legacyIdentityNumber() == null && data.citizenIdentityNumber() == null) {
                issuesByRow.get(entry.getKey()).add(new HrImportIssue(
                        HrImportIssueCode.MISSING_REVIEW_FIELD,
                        HrImportIssueSeverity.WARNING,
                        "T" + data.sourceRowNumber(),
                        "identityNumber",
                        "Thiếu cả CMND và CCCD; cần xác minh."
                ));
            }
        }

        int validRows = 0;
        int warningRows = 0;
        int invalidRows = 0;
        Map<String, Integer> issueCounts = new TreeMap<>();
        for (HrExcelImportRow row : rows) {
            List<HrImportIssue> rowIssues = List.copyOf(issuesByRow.get(row));
            boolean invalid = rowIssues.stream().anyMatch(issue -> issue.severity() == HrImportIssueSeverity.ERROR);
            boolean warning = rowIssues.stream().anyMatch(issue -> issue.severity() == HrImportIssueSeverity.WARNING);
            if (invalid) {
                row.setRowStatus(HrImportRowStatus.INVALID);
                invalidRows++;
            } else if (warning) {
                row.setRowStatus(HrImportRowStatus.WARNING);
                warningRows++;
            } else {
                row.setRowStatus(HrImportRowStatus.VALID);
                validRows++;
            }
            row.setIssueCodes(json(rowIssues));
            rowIssues.forEach(issue -> issueCounts.merge(issue.code().name(), 1, Integer::sum));
        }
        rowRepository.saveAll(rows);

        batch.setValidRows(validRows);
        batch.setWarningRows(warningRows);
        batch.setInvalidRows(invalidRows);
        batch.setIssueSummary(json(Map.of(
                "validRows", validRows,
                "warningRows", warningRows,
                "invalidRows", invalidRows,
                "issueCounts", issueCounts
        )));
        batch.setValidatedAt(nowUtc());
        batch.setStatus(HrImportBatchStatus.VALIDATED);
        batch.setUpdatedByActor(actor.subject());
        batchRepository.save(batch);
        audit(actor, "BASELINE_IMPORT_VALIDATED", "HR_IMPORT_BATCH", batch.getId(), null,
                Map.of("validRows", validRows, "warningRows", warningRows, "invalidRows", invalidRows));
        return summary(batch);
    }

    @Transactional(readOnly = true)
    public HrImportPreviewPage preview(String batchId, int pageNumber, int pageSize) {
        int safePage = Math.max(0, pageNumber);
        int safeSize = Math.max(1, Math.min(100, pageSize));
        HrExcelImportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> failure("BATCH_NOT_FOUND", "Không tìm thấy batch import."));
        Page<HrExcelImportRow> page = rowRepository.findByBatch_IdOrderByRowNumber(
                batchId,
                PageRequest.of(safePage, safeSize)
        );
        List<HrImportPreviewRow> previewRows = page.getContent().stream()
                .map(row -> new HrImportPreviewRow(
                        row.getRowNumber(),
                        row.getRowStatus(),
                        row.getNormalizedPayload() == null ? null : read(row.getNormalizedPayload(), HrBaselineRowData.class),
                        issues(row.getIssueCodes())
                ))
                .toList();
        return new HrImportPreviewPage(
                summary(batch),
                previewRows,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional
    public HrImportBatchSummary confirm(
            String batchId,
            String confirmationKey,
            boolean acceptWarnings,
            HrImportActor actor
    ) {
        validateRetentionConfiguration();
        String safeConfirmationKey = confirmationKey(confirmationKey);
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireBaselineType(batch);
        if (batch.getStatus() == HrImportBatchStatus.CONFIRMED) {
            if (safeConfirmationKey.equals(batch.getConfirmationKey())) return summary(batch);
            throw failure("BATCH_ALREADY_CONFIRMED", "Batch đã được confirm bằng confirmation key khác.");
        }
        requireStatus(batch, HrImportBatchStatus.VALIDATED, "BATCH_NOT_VALIDATED");
        if (batch.getInvalidRows() > 0) {
            throw failure("INVALID_ROWS_BLOCK_CONFIRM", "Batch còn dòng không hợp lệ nên không thể confirm.");
        }
        if (batch.getWarningRows() > 0 && !acceptWarnings) {
            throw failure("WARNINGS_REQUIRE_ACKNOWLEDGEMENT", "Cần xác nhận chấp nhận warning trước khi import.");
        }
        batchRepository.findByConfirmationKey(safeConfirmationKey).ifPresent(existing -> {
            if (!existing.getId().equals(batchId)) {
                throw failure("CONFIRMATION_KEY_ALREADY_USED", "Confirmation key đã được sử dụng cho batch khác.");
            }
        });

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        if (rows.size() != batch.getTotalRows()
                || rows.stream().anyMatch(row -> row.getRowStatus() != HrImportRowStatus.VALID
                && row.getRowStatus() != HrImportRowStatus.WARNING)) {
            throw failure("STAGING_NOT_READY", "Staging rows chưa sẵn sàng để confirm.");
        }
        List<HrBaselineRowData> data = rows.stream()
                .map(row -> read(row.getNormalizedPayload(), HrBaselineRowData.class))
                .sorted(Comparator.comparingInt(HrBaselineRowData::displayOrder))
                .toList();
        List<String> employeeCodes = data.stream().map(HrBaselineRowData::employeeCode).toList();
        if (!employeeRepository.findAllByEmployeeCodeIn(employeeCodes).isEmpty()) {
            throw failure("EMPLOYEE_CODE_ALREADY_EXISTS", "Có mã nhân viên đã tồn tại; confirm bị dừng nguyên tử.");
        }
        if (rosterRepository.findByPeriodStart(HrBaselineWorkbookParser.PERIOD_START).isPresent()) {
            throw failure("BASELINE_ROSTER_ALREADY_EXISTS", "Kỳ T6-26 đã tồn tại trong HR domain.");
        }

        LocalDateTime now = nowUtc();
        Map<String, HrDepartment> departments = resolveDepartments(data, actor);
        Map<String, HrPosition> positions = resolvePositions(data, actor);
        Map<String, HrWorkingCondition> conditions = resolveWorkingConditions(data, actor);
        Map<String, HrEmployee> employeeByCode = new HashMap<>();
        Map<String, HrEmployeeMovement> movementByCode = new HashMap<>();

        for (HrBaselineRowData source : data) {
            HrEmployee employee = new HrEmployee();
            employee.setEmployeeCode(source.employeeCode());
            employee.setFullName(source.fullName());
            employee.setGender(source.gender());
            employee.setDateOfBirth(source.dateOfBirth());
            employee.setEthnicity(source.ethnicity());
            employee.setReligion(source.religion());
            employee.setBirthPlaceOriginal(source.birthPlaceOriginal());
            employee.setBirthPlaceCurrent(source.birthPlaceCurrent());
            employee.setEducationLevel(source.educationLevel());
            employee.setMajor(source.major());
            employee.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
            employee.setStatusEffectiveDate(HrBaselineWorkbookParser.PERIOD_START);
            employee.setSourceImportBatch(batch);
            auditFields(employee, actor);
            employee = employeeRepository.save(employee);
            employeeByCode.put(canonicalKey(source.employeeCode()), employee);

            HrDepartment department = departments.get(catalogKey(source.departmentName()));
            HrPosition position = positions.get(catalogKey(source.positionName()));
            HrWorkingCondition condition = source.workingConditionName() == null
                    ? null : conditions.get(catalogKey(source.workingConditionName()));

            HrEmployeeEmployment employment = new HrEmployeeEmployment();
            employment.setEmployee(employee);
            employment.setDepartment(department);
            employment.setPosition(position);
            employment.setWorkingCondition(condition);
            employment.setHireDate(source.hireDate());
            // Workbook chỉ ghi "NGÀY LÀM"; không tự suy diễn thành mốc tính phép.
            employment.setLeaveAccrualStartDate(null);
            employment.setContractTypeLabel(source.contractTypeLabel());
            employment.setContractNumber(source.contractNumber());
            employment.setBaseSalary(source.baseSalary());
            employment.setAllowance(source.allowance());
            employment.setJobDescription(source.jobDescription());
            auditFields(employment, actor);
            employmentRepository.save(employment);

            HrEmployeeIdentity identity = new HrEmployeeIdentity();
            identity.setEmployee(employee);
            identity.setLegacyIdentityNumber(source.legacyIdentityNumber());
            identity.setCitizenIdentityNumber(source.citizenIdentityNumber());
            identity.setIssuedDate(source.identityIssuedDate());
            identity.setIssuedPlace(source.identityIssuedPlace());
            identity.setVerificationStatus(HrIdentityVerificationStatus.NEEDS_REVIEW);
            auditFields(identity, actor);
            identityRepository.save(identity);

            HrEmployeeInsurance insurance = new HrEmployeeInsurance();
            insurance.setEmployee(employee);
            insurance.setSocialInsuranceNumber(source.socialInsuranceNumber());
            insurance.setHealthInsuranceNumber(source.healthInsuranceNumber());
            insurance.setStatus(HrInsuranceStatus.NEEDS_REVIEW);
            auditFields(insurance, actor);
            insuranceRepository.save(insurance);

            HrEmployeeContact contact = new HrEmployeeContact();
            contact.setEmployee(employee);
            contact.setPermanentAddress(source.permanentAddress());
            contact.setCurrentAddress(source.currentAddress());
            contact.setPhone(source.phone());
            auditFields(contact, actor);
            contactRepository.save(contact);

            HrEmployeeMovement movement = new HrEmployeeMovement();
            movement.setEmployee(employee);
            movement.setMovementType(HrMovementType.INITIAL_LOAD);
            movement.setStatus(HrMovementStatus.CONFIRMED);
            movement.setEffectiveDate(HrBaselineWorkbookParser.PERIOD_START);
            movement.setToDepartment(department);
            movement.setToPosition(position);
            movement.setToWorkingCondition(condition);
            movement.setToEmployeeStatus(HrEmploymentStatus.ACTIVE);
            movement.setSourceKind(HrMovementSourceKind.BASELINE_IMPORT);
            movement.setImportBatch(batch);
            movement.setIdempotencyKey("BASELINE:" + sha256(batch.getFileSha256() + ":" + source.employeeCode()));
            movement.setConfirmedAt(now);
            movement.setConfirmedByActor(actor.subject());
            auditFields(movement, actor);
            movement = movementRepository.save(movement);
            movementByCode.put(canonicalKey(source.employeeCode()), movement);
        }

        HrMonthlyRoster roster = new HrMonthlyRoster();
        roster.setPeriodStart(HrBaselineWorkbookParser.PERIOD_START);
        roster.setStatus(HrRosterStatus.CLOSED);
        roster.setSourceImportBatch(batch);
        roster.setSnapshotSchemaVersion((short) 1);
        roster.setItemCount(data.size());
        roster.setOpenedAt(now);
        roster.setOpenedByActor(actor.subject());
        roster.setClosedAt(now);
        roster.setClosedByActor(actor.subject());
        auditFields(roster, actor);
        roster = rosterRepository.save(roster);

        List<String> itemHashes = new ArrayList<>(data.size());
        List<HrMonthlyRosterItem> items = new ArrayList<>(data.size());
        for (HrBaselineRowData source : data) {
            HrEmployee employee = employeeByCode.get(canonicalKey(source.employeeCode()));
            HrEmployeeMovement movement = movementByCode.get(canonicalKey(source.employeeCode()));
            HrDepartment department = departments.get(catalogKey(source.departmentName()));
            HrPosition position = positions.get(catalogKey(source.positionName()));
            HrWorkingCondition condition = source.workingConditionName() == null
                    ? null : conditions.get(catalogKey(source.workingConditionName()));
            String snapshotJson = json(rosterSnapshot(source, department, position, condition));
            String payloadHash = sha256(snapshotJson);
            itemHashes.add(payloadHash);

            HrMonthlyRosterItem item = new HrMonthlyRosterItem();
            item.setRoster(roster);
            item.setEmployee(employee);
            item.setDisplayOrder(source.displayOrder());
            item.setDepartmentDisplayOrder(source.departmentDisplayOrder());
            item.setEmployeeCode(source.employeeCode());
            item.setFullName(source.fullName());
            item.setDepartmentCode(department == null ? null : department.getCode());
            item.setDepartmentName(department == null ? null : department.getName());
            item.setPositionCode(position == null ? null : position.getCode());
            item.setPositionName(position == null ? null : position.getName());
            item.setWorkingConditionCode(condition == null ? null : condition.getCode());
            item.setWorkingConditionName(condition == null ? null : condition.getName());
            item.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
            item.setHireDate(source.hireDate());
            item.setLeaveDays(source.leaveDays());
            item.setInclusionReason(HrRosterInclusionReason.BASELINE);
            item.setSourceMovement(movement);
            item.setSnapshotSchemaVersion((short) 1);
            item.setSnapshotPayload(snapshotJson);
            item.setPayloadSha256(payloadHash);
            item.setCreatedByActor(actor.subject());
            items.add(item);
        }
        rosterItemRepository.saveAll(items);
        roster.setRosterChecksum(sha256(String.join("", itemHashes)));
        rosterRepository.save(roster);

        Map<Integer, HrExcelImportRow> rowByNumber = rows.stream()
                .collect(Collectors.toMap(HrExcelImportRow::getRowNumber, Function.identity()));
        for (HrBaselineRowData source : data) {
            HrExcelImportRow row = rowByNumber.get(source.sourceRowNumber());
            row.setEmployee(employeeByCode.get(canonicalKey(source.employeeCode())));
            row.setMovement(movementByCode.get(canonicalKey(source.employeeCode())));
            row.setRowStatus(HrImportRowStatus.IMPORTED);
        }
        rowRepository.saveAll(rows);

        batch.setConfirmationKey(safeConfirmationKey);
        batch.setImportedRows(data.size());
        batch.setConfirmedAt(now);
        batch.setConfirmedByActor(actor.subject());
        batch.setPayloadRetentionUntil(now.plusDays(payloadRetentionDays));
        batch.setStatus(HrImportBatchStatus.CONFIRMED);
        batch.setUpdatedByActor(actor.subject());
        batchRepository.save(batch);
        audit(actor, "BASELINE_IMPORT_CONFIRMED", "HR_IMPORT_BATCH", batch.getId(), safeConfirmationKey,
                Map.of("importedRows", data.size(), "period", "2026-06"));
        return summary(batch);
    }

    @Transactional
    public HrImportBatchSummary rollback(String batchId, HrImportActor actor) {
        validateRetentionConfiguration();
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireBaselineType(batch);
        if (batch.getStatus() == HrImportBatchStatus.ROLLED_BACK) return summary(batch);
        requireStatus(batch, HrImportBatchStatus.CONFIRMED, "BATCH_NOT_CONFIRMED");

        List<HrEmployee> employees = employeeRepository.findAllBySourceImportBatch_Id(batchId);
        List<String> employeeIds = employees.stream().map(HrEmployee::getId).toList();
        List<HrEmployeeMovement> movements = movementRepository.findAllByImportBatch_Id(batchId);
        List<HrMonthlyRoster> rosters = rosterRepository.findAllBySourceImportBatch_Id(batchId);
        if (employees.size() != batch.getImportedRows()
                || movements.size() != batch.getImportedRows()
                || rosters.size() != 1
                || employees.stream().anyMatch(employee -> employee.getRowVersion() != 0)
                || movements.stream().anyMatch(movement -> movement.getMovementType() != HrMovementType.INITIAL_LOAD)) {
            throw failure("ROLLBACK_GUARD_FAILED", "Dữ liệu import đã thay đổi; không thể rollback tự động.");
        }
        HrMonthlyRoster roster = rosters.getFirst();
        if (roster.getStatus() != HrRosterStatus.CLOSED
                || rosterRepository.existsBySourceRoster_Id(roster.getId())
                || movementRepository.countDownstreamMovements(employeeIds, batchId) > 0
                || rosterItemRepository.countDownstreamRosterItems(employeeIds, roster.getId()) > 0) {
            throw failure("ROLLBACK_HAS_DOWNSTREAM_DATA", "Đã có dữ liệu HR phát sinh sau baseline; rollback bị chặn.");
        }

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        for (HrExcelImportRow row : rows) {
            row.setEmployee(null);
            row.setMovement(null);
            row.setRowStatus(HrImportRowStatus.ROLLED_BACK);
        }
        rowRepository.saveAll(rows);
        entityManager.flush();

        for (HrMonthlyRosterItem item : rosterItemRepository.findAllByRoster_IdOrderByDisplayOrder(roster.getId())) {
            entityManager.remove(item);
        }
        entityManager.flush();
        entityManager.remove(roster);
        for (HrEmployeeMovement movement : movements) entityManager.remove(movement);
        entityManager.flush();
        for (HrEmployee employee : employees) entityManager.remove(employee);
        entityManager.flush();

        LocalDateTime now = nowUtc();
        batch.setStatus(HrImportBatchStatus.ROLLED_BACK);
        batch.setImportedRows(0);
        batch.setRolledBackAt(now);
        batch.setRolledBackByActor(actor.subject());
        batch.setPayloadRetentionUntil(now.plusDays(payloadRetentionDays));
        batch.setUpdatedByActor(actor.subject());
        batchRepository.save(batch);
        audit(actor, "BASELINE_IMPORT_ROLLED_BACK", "HR_IMPORT_BATCH", batch.getId(), batch.getConfirmationKey(),
                Map.of("rolledBackRows", employees.size()));
        return summary(batch);
    }

    @Transactional
    public int purgeExpiredPayloads(HrImportActor actor) {
        LocalDateTime now = nowUtc();
        Page<HrExcelImportBatch> candidates = batchRepository
                .findByPayloadPurgedAtIsNullAndPayloadRetentionUntilLessThanEqualAndStatusIn(
                        now,
                        PURGEABLE_STATUSES,
                        PageRequest.of(0, 50, Sort.by("payloadRetentionUntil").ascending())
                );
        int purged = 0;
        for (HrExcelImportBatch candidate : candidates) {
            HrExcelImportBatch batch = batchRepository.findLockedById(candidate.getId()).orElse(null);
            if (batch == null || batch.getPayloadPurgedAt() != null
                    || batch.getPayloadRetentionUntil() == null
                    || batch.getPayloadRetentionUntil().isAfter(now)
                    || !PURGEABLE_STATUSES.contains(batch.getStatus())) {
                continue;
            }
            List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batch.getId());
            boolean expiredBeforeConfirmation = batch.getStatus() == HrImportBatchStatus.PARSED
                    || batch.getStatus() == HrImportBatchStatus.VALIDATED;
            for (HrExcelImportRow row : rows) {
                row.setRawPayload(null);
                row.setNormalizedPayload(null);
                row.setEmployeeCodeHint(null);
                if (expiredBeforeConfirmation) row.setRowStatus(HrImportRowStatus.SKIPPED);
            }
            rowRepository.saveAll(rows);
            if (expiredBeforeConfirmation) {
                batch.setStatus(HrImportBatchStatus.FAILED);
                batch.setIssueSummary(json(Map.of("failureCode", "PAYLOAD_RETENTION_EXPIRED")));
            }
            batch.setStorageKey(null);
            batch.setPayloadPurgedAt(now);
            batch.setPayloadPurgedByActor(actor.subject());
            batch.setUpdatedByActor(actor.subject());
            batchRepository.save(batch);
            audit(actor, "IMPORT_PAYLOAD_PURGED", "HR_IMPORT_BATCH", batch.getId(), null,
                    Map.of("purgedRows", rows.size(), "expiredBeforeConfirmation", expiredBeforeConfirmation));
            purged++;
        }
        return purged;
    }

    private static Map<String, Object> rosterSnapshot(
            HrBaselineRowData source,
            HrDepartment department,
            HrPosition position,
            HrWorkingCondition condition
    ) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("snapshotSchemaVersion", 1);
        snapshot.put("displayOrder", source.displayOrder());
        snapshot.put("departmentDisplayOrder", source.departmentDisplayOrder());
        snapshot.put("employeeCode", source.employeeCode());
        snapshot.put("fullName", source.fullName());
        snapshot.put("departmentCode", department == null ? null : department.getCode());
        snapshot.put("departmentName", department == null ? null : department.getName());
        snapshot.put("positionCode", position == null ? null : position.getCode());
        snapshot.put("positionName", position == null ? null : position.getName());
        snapshot.put("workingConditionCode", condition == null ? null : condition.getCode());
        snapshot.put("workingConditionName", condition == null ? null : condition.getName());
        snapshot.put("employmentStatus", HrEmploymentStatus.ACTIVE.name());
        snapshot.put("hireDate", source.hireDate());
        snapshot.put("leaveDays", source.leaveDays());
        snapshot.put("inclusionReason", HrRosterInclusionReason.BASELINE.name());
        return snapshot;
    }

    private HrExcelTemplateVersion findOrCreateTemplate(HrImportActor actor) {
        return templateRepository.findByFileSha256(baselineContract.expectedSha256())
                .or(() -> templateRepository.findByTemplateKeyAndVersionCode(
                        HrBaselineImportContract.TEMPLATE_KEY,
                        HrBaselineImportContract.VERSION_CODE
                ))
                .orElseGet(() -> {
                    HrExcelTemplateVersion template = new HrExcelTemplateVersion();
                    template.setTemplateKey(HrBaselineImportContract.TEMPLATE_KEY);
                    template.setVersionCode(HrBaselineImportContract.VERSION_CODE);
                    template.setSchemaVersion((short) 1);
                    template.setFileName(HrBaselineImportContract.LOCKED_FILE_NAME);
                    // The template row identifies the canonical T6 contract artifact,
                    // while an import batch keeps the checksum of the uploaded bundle.
                    // This lets the locked one-file 339 bundle reuse the same T6
                    // schema without violating the unique template key/version.
                    template.setFileSha256(baselineContract.expectedSha256());
                    template.setSheetContract(json(Map.of(
                            "sheet", HrBaselineWorkbookParser.SOURCE_SHEET,
                            "range", "A4:AH333",
                            "headerRow", 4,
                            "dataRows", "5:333",
                            "columnCount", 34
                    )));
                    template.setContainsPii(true);
                    template.setStatus(HrTemplateStatus.ACTIVE);
                    template.setEffectiveFrom(HrBaselineWorkbookParser.PERIOD_START);
                    auditFields(template, actor);
                    return templateRepository.save(template);
                });
    }

    private HrExcelTemplateVersion findOrCreateWorkforceBaselineTemplate(HrImportActor actor) {
        return templateRepository.findByFileSha256(HrWorkforceSnapshotContract.LOCKED_SHA256)
                .or(() -> templateRepository.findByTemplateKeyAndVersionCode(
                        "HR_WORKFORCE_BASELINE_2026",
                        "2026-06-339"
                ))
                .orElseGet(() -> {
                    HrExcelTemplateVersion template = new HrExcelTemplateVersion();
                    template.setTemplateKey("HR_WORKFORCE_BASELINE_2026");
                    template.setVersionCode("2026-06-339");
                    template.setSchemaVersion((short) 1);
                    template.setFileName(HrWorkforceSnapshotContract.LOCKED_FILE_NAME);
                    template.setFileSha256(HrWorkforceSnapshotContract.LOCKED_SHA256);
                    template.setSheetContract(json(Map.of(
                            "sheet", HrBaselineWorkbookParser.WORKFORCE_BASELINE_SHEET,
                            "range", "A4:AH343",
                            "headerRow", 4,
                            "dataRows", "5:343",
                            "columnCount", 34
                    )));
                    template.setContainsPii(true);
                    template.setStatus(HrTemplateStatus.ACTIVE);
                    template.setEffectiveFrom(HrBaselineWorkbookParser.WORKFORCE_BASELINE_PERIOD_START);
                    auditFields(template, actor);
                    return templateRepository.save(template);
                });
    }

    private Map<String, HrDepartment> resolveDepartments(List<HrBaselineRowData> rows, HrImportActor actor) {
        Map<String, HrDepartment> result = new HashMap<>();
        for (HrBaselineRowData row : rows) {
            String key = catalogKey(row.departmentName());
            if (result.containsKey(key)) continue;
            String code = catalogCode("DEP", key);
            HrDepartment department = departmentRepository.findByCode(code).orElseGet(() -> {
                HrDepartment created = new HrDepartment();
                created.setCode(code);
                created.setName(row.departmentName());
                created.setSortOrder(Math.max(0, row.departmentDisplayOrder() == null ? 0 : row.departmentDisplayOrder()));
                auditFields(created, actor);
                return departmentRepository.save(created);
            });
            requireCatalogMatch(key, department.getName());
            result.put(key, department);
        }
        return result;
    }

    private Map<String, HrPosition> resolvePositions(List<HrBaselineRowData> rows, HrImportActor actor) {
        Map<String, HrPosition> result = new HashMap<>();
        for (HrBaselineRowData row : rows) {
            String key = catalogKey(row.positionName());
            if (result.containsKey(key)) continue;
            String code = catalogCode("POS", key);
            HrPosition position = positionRepository.findByCode(code).orElseGet(() -> {
                HrPosition created = new HrPosition();
                created.setCode(code);
                created.setName(row.positionName());
                auditFields(created, actor);
                return positionRepository.save(created);
            });
            requireCatalogMatch(key, position.getName());
            result.put(key, position);
        }
        return result;
    }

    private Map<String, HrWorkingCondition> resolveWorkingConditions(
            List<HrBaselineRowData> rows,
            HrImportActor actor
    ) {
        Map<String, HrWorkingCondition> result = new HashMap<>();
        for (HrBaselineRowData row : rows) {
            if (row.workingConditionName() == null) continue;
            String key = catalogKey(row.workingConditionName());
            if (result.containsKey(key)) continue;
            String code = catalogCode("WC", key);
            HrWorkingCondition condition = workingConditionRepository.findByCode(code).orElseGet(() -> {
                HrWorkingCondition created = new HrWorkingCondition();
                created.setCode(code);
                created.setName(row.workingConditionName());
                auditFields(created, actor);
                return workingConditionRepository.save(created);
            });
            requireCatalogMatch(key, condition.getName());
            result.put(key, condition);
        }
        return result;
    }

    private void addDuplicateIssues(
            Map<HrExcelImportRow, HrBaselineRowData> dataByRow,
            Map<HrExcelImportRow, List<HrImportIssue>> issuesByRow,
            Function<HrBaselineRowData, String> extractor,
            HrImportIssueCode code,
            HrImportIssueSeverity severity,
            String field,
            int column,
            String message
    ) {
        Map<String, List<HrExcelImportRow>> groups = new HashMap<>();
        for (Map.Entry<HrExcelImportRow, HrBaselineRowData> entry : dataByRow.entrySet()) {
            String value = extractor.apply(entry.getValue());
            if (value != null && !value.isBlank()) {
                groups.computeIfAbsent(canonicalKey(value), ignored -> new ArrayList<>()).add(entry.getKey());
            }
        }
        groups.values().stream().filter(group -> group.size() > 1).forEach(group -> group.forEach(row ->
                issuesByRow.get(row).add(new HrImportIssue(
                        code,
                        severity,
                        columnName(column) + row.getRowNumber(),
                        field,
                        message
                ))
        ));
    }

    private void audit(
            HrImportActor actor,
            String action,
            String entityType,
            String entityId,
            String correlationId,
            Map<String, ?> metadata
    ) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(entityType);
        event.setEntityId(entityId);
        event.setCorrelationId(correlationId == null ? null : truncate(correlationId, 64));
        event.setSanitizedMetadata(json(metadata));
        auditRepository.save(event);
    }

    private static void auditFields(HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private HrExcelImportBatch lockedBatch(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            throw failure("BATCH_ID_REQUIRED", "Batch id là bắt buộc.");
        }
        return batchRepository.findLockedById(batchId)
                .orElseThrow(() -> failure("BATCH_NOT_FOUND", "Không tìm thấy batch import."));
    }

    private static void requireStatus(HrExcelImportBatch batch, HrImportBatchStatus expected, String code) {
        if (batch.getStatus() != expected) {
            throw failure(code, "Trạng thái batch không phù hợp với thao tác.");
        }
    }

    private static void requireBaselineType(HrExcelImportBatch batch) {
        if (batch.getImportType() != HrImportType.BASELINE) {
            throw failure(
                    "IMPORT_TYPE_NOT_SUPPORTED",
                    "Thao tác này chỉ áp dụng cho batch baseline."
            );
        }
    }

    private HrImportBatchSummary summary(HrExcelImportBatch batch) {
        return new HrImportBatchSummary(
                batch.getId(), batch.getStatus(), batch.getAttemptNumber(), batch.getTotalRows(),
                batch.getValidRows(), batch.getWarningRows(), batch.getInvalidRows(), batch.getImportedRows(),
                batch.getFileSha256(), batch.getParsedAt(), batch.getValidatedAt(), batch.getConfirmedAt(),
                batch.getRolledBackAt(), batch.getPayloadRetentionUntil(), batch.getPayloadPurgedAt()
        );
    }

    private String json(Object value) {
        try {
            return jsonCodec.write(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể serialize HR import payload.", exception);
        }
    }

    private <T> T read(String value, Class<T> type) {
        if (value == null) throw failure("PAYLOAD_PURGED", "Payload staging đã được purge.");
        try {
            return jsonCodec.read(value, type);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể đọc HR import payload.", exception);
        }
    }

    private List<HrImportIssue> issues(String value) {
        if (value == null || value.isBlank()) return List.of();
        try {
            return jsonCodec.read(value, ISSUE_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể đọc HR import issues.", exception);
        }
    }

    private void validateRetentionConfiguration() {
        if (payloadRetentionDays < 1 || payloadRetentionDays > 3650) {
            throw new IllegalStateException("app.hr.import.payload-retention-days must be between 1 and 3650");
        }
    }

    private static String safeFileName(String value) {
        String candidate = value == null ? "" : value.replace('\\', '/');
        candidate = candidate.substring(candidate.lastIndexOf('/') + 1).trim();
        if (candidate.isEmpty()) candidate = HrBaselineImportContract.LOCKED_FILE_NAME;
        return truncate(candidate, 255);
    }

    private static String confirmationKey(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw failure("CONFIRMATION_KEY_INVALID", "Confirmation key phải có từ 1 đến 100 ký tự.");
        }
        return normalized;
    }

    private static String catalogKey(String value) {
        if (value == null || value.isBlank()) throw failure("CATALOG_VALUE_MISSING", "Thiếu danh mục bắt buộc.");
        return value.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    private static String catalogCode(String prefix, String key) {
        return prefix + "-" + sha256(prefix + ":" + key).substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private static void requireCatalogMatch(String expectedKey, String actualName) {
        if (!expectedKey.equals(catalogKey(actualName))) {
            throw failure("CATALOG_CODE_COLLISION", "Phát hiện xung đột mã danh mục deterministic.");
        }
    }

    private static String canonicalKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }

    private static String columnName(int zeroBasedColumn) {
        int value = zeroBasedColumn + 1;
        StringBuilder name = new StringBuilder();
        while (value > 0) {
            int remainder = (value - 1) % 26;
            name.append((char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return name.reverse().toString();
    }

    private static HrBaselineImportException failure(String code, String message) {
        return new HrBaselineImportException(code, message);
    }
}

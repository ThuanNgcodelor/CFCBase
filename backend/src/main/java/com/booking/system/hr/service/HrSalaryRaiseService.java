package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrSalaryRaiseDtos;
import com.booking.system.hr.entity.*;
import com.booking.system.hr.enums.*;
import com.booking.system.hr.importer.*;
import com.booking.system.hr.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.text.Normalizer;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HrSalaryRaiseService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<HrImportIssueCode> DATABASE_ISSUES = EnumSet.of(
            HrImportIssueCode.DUPLICATE_EMPLOYEE_CODE,
            HrImportIssueCode.EMPLOYEE_NOT_FOUND,
            HrImportIssueCode.EMPLOYMENT_NOT_FOUND,
            HrImportIssueCode.EMPLOYEE_NAME_MISMATCH,
            HrImportIssueCode.CURRENT_SALARY_MISMATCH,
            HrImportIssueCode.CURRENT_ALLOWANCE_MISMATCH,
            HrImportIssueCode.SALARY_CHANGE_DUPLICATE
    );

    private final HrSalaryRaiseWorkbookParser parser;
    private final HrExcelImportBatchRepository batchRepository;
    private final HrExcelImportRowRepository rowRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeEmploymentRepository employmentRepository;
    private final HrEmployeeSalaryChangeRepository salaryChangeRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final EntityManager entityManager;

    @Value("${app.hr.import.payload-retention-days:30}")
    private int payloadRetentionDays;

    @Transactional
    public HrSalaryRaiseDtos.BatchResponse upload(String originalFileName, byte[] bytes, HrImportActor actor) {
        HrSalaryRaiseWorkbookParser.ParsedWorkbook workbook = parser.parse(bytes);
        Optional<HrExcelImportBatch> existing = batchRepository
                .findFirstByFileSha256AndSourceSheetNameAndImportTypeOrderByAttemptNumberDesc(
                        workbook.sha256(), workbook.sheetName(), HrImportType.SALARY_RAISE);
        if (existing.isPresent() && existing.get().getStatus() != HrImportBatchStatus.FAILED
                && existing.get().getStatus() != HrImportBatchStatus.ROLLED_BACK) {
            return HrSalaryRaiseDtos.BatchResponse.from(existing.get());
        }

        LocalDateTime now = nowUtc();
        HrExcelImportBatch batch = new HrExcelImportBatch();
        batch.setImportType(HrImportType.SALARY_RAISE);
        batch.setSourceFileName(safeFileName(originalFileName));
        batch.setFileSha256(workbook.sha256());
        batch.setFileSize(workbook.fileSize());
        batch.setSourceSheetName(workbook.sheetName());
        batch.setAttemptNumber(existing.map(value -> value.getAttemptNumber() + 1).orElse(1));
        if (workbook.firstEffectiveDate() != null) {
            batch.setSourcePeriodYear((short) workbook.firstEffectiveDate().getYear());
            batch.setSourcePeriodMonth((byte) workbook.firstEffectiveDate().getMonthValue());
        }
        batch.setStatus(HrImportBatchStatus.PARSED);
        batch.setTotalRows(workbook.rows().size());
        batch.setParsedAt(now);
        batch.setPayloadRetentionUntil(now.plusDays(payloadRetentionDays));
        initialize(batch, actor);
        batch = batchRepository.save(batch);

        List<HrExcelImportRow> rows = new ArrayList<>(workbook.rows().size());
        for (HrSalaryRaiseWorkbookParser.ParsedRow parsed : workbook.rows()) {
            HrExcelImportRow row = new HrExcelImportRow();
            row.setBatch(batch);
            row.setSheetName(workbook.sheetName());
            row.setRowNumber(parsed.sourceRowNumber());
            row.setEmployeeCodeHint(parsed.data().employeeCode());
            row.setRowStatus(HrImportRowStatus.PENDING);
            String payload = json(parsed.data());
            row.setRawPayload(payload);
            row.setNormalizedPayload(payload);
            row.setPayloadSha256(sha256(payload));
            row.setIssueCodes(json(parsed.issues()));
            rows.add(row);
        }
        rowRepository.saveAll(rows);
        audit(actor, "SALARY_RAISE_IMPORT_PARSED", "HR_IMPORT_BATCH", batch.getId(), null,
                Map.of("rowCount", rows.size(), "attemptNumber", batch.getAttemptNumber()));
        return HrSalaryRaiseDtos.BatchResponse.from(batch);
    }

    @Transactional
    public HrSalaryRaiseDtos.BatchResponse validate(String batchId, HrImportActor actor) {
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireSalaryBatch(batch);
        if (batch.getStatus() != HrImportBatchStatus.PARSED
                && batch.getStatus() != HrImportBatchStatus.VALIDATED) {
            throw HrApiException.conflict("SALARY_RAISE_BATCH_NOT_PARSABLE",
                    "Chỉ batch đã phân tích mới có thể kiểm tra.");
        }
        requirePayload(batch);

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        List<HrSalaryRaiseDtos.RowData> data = rows.stream().map(this::rowData).toList();
        Map<String, Long> codeCounts = data.stream().filter(value -> value.employeeCode() != null)
                .collect(Collectors.groupingBy(HrSalaryRaiseDtos.RowData::employeeCode, Collectors.counting()));
        Set<String> codes = data.stream().map(HrSalaryRaiseDtos.RowData::employeeCode)
                .filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, HrEmployee> employees = employeeRepository.findAllByEmployeeCodeIn(codes).stream()
                .collect(Collectors.toMap(HrEmployee::getEmployeeCode, Function.identity()));
        Map<String, List<HrEmployeeSalaryChange>> timelines = timelines(employees.values());

        int valid = 0;
        int warning = 0;
        int invalid = 0;
        for (int index = 0; index < rows.size(); index++) {
            HrExcelImportRow row = rows.get(index);
            HrSalaryRaiseDtos.RowData source = data.get(index);
            List<HrImportIssue> issues = issues(row.getIssueCodes()).stream()
                    .filter(issue -> !DATABASE_ISSUES.contains(issue.code()))
                    .collect(Collectors.toCollection(ArrayList::new));
            if (source.employeeCode() != null && codeCounts.getOrDefault(source.employeeCode(), 0L) > 1) {
                issues.add(error(HrImportIssueCode.DUPLICATE_EMPLOYEE_CODE, "employeeCode",
                        "MS bị trùng trong cùng file nâng lương."));
            }
            HrEmployee employee = employees.get(source.employeeCode());
            HrSalaryRaiseDtos.RowData resolved = source;
            if (employee == null) {
                issues.add(error(HrImportIssueCode.EMPLOYEE_NOT_FOUND, "employeeCode",
                        "Không tìm thấy MS trong dữ liệu nhân sự."));
            } else if (employee.getEmployment() == null) {
                issues.add(error(HrImportIssueCode.EMPLOYMENT_NOT_FOUND, "employeeCode",
                        "Nhân viên chưa có thông tin công việc để đối chiếu lương."));
            } else {
                Compensation before = compensationAt(employee,
                        source.effectiveDate() == null ? LocalDate.now(BUSINESS_ZONE)
                                : source.effectiveDate().minusDays(1),
                        timelines.getOrDefault(employee.getId(), List.of()));
                resolved = source.withDatabase(employee.getId(), employee.getFullName(),
                        before.baseSalary(), before.allowance());
                if (!normalizedName(employee.getFullName()).equals(normalizedName(source.fullName()))) {
                    issues.add(warning(HrImportIssueCode.EMPLOYEE_NAME_MISMATCH, "fullName",
                            "Họ tên trong file khác hồ sơ DB; hệ thống vẫn ghép theo MS."));
                }
                if (!moneyEquals(before.baseSalary(), source.currentBaseSalary())) {
                    issues.add(error(HrImportIssueCode.CURRENT_SALARY_MISMATCH, "currentBaseSalary",
                            mismatchMessage("Lương", source.currentBaseSalary(), before.baseSalary())));
                }
                if (!moneyEquals(before.allowance(), source.currentAllowance())) {
                    issues.add(error(HrImportIssueCode.CURRENT_ALLOWANCE_MISMATCH, "currentAllowance",
                            mismatchMessage("Phụ cấp", source.currentAllowance(), before.allowance())));
                }
                if (source.effectiveDate() != null && source.newBaseSalary() != null
                        && source.newAllowance() != null && source.newGrade() != null
                        && salaryChangeRepository.existsByIdempotencyKey(idempotencyKey(employee.getId(), source))) {
                    issues.add(error(HrImportIssueCode.SALARY_CHANGE_DUPLICATE, "employeeCode",
                            "Đợt nâng lương này đã tồn tại trong lịch sử."));
                }
            }
            HrImportRowStatus status = status(issues);
            if (status == HrImportRowStatus.INVALID) invalid++;
            else if (status == HrImportRowStatus.WARNING) warning++;
            else valid++;
            row.setNormalizedPayload(json(resolved));
            row.setIssueCodes(json(issues));
            row.setRowStatus(status);
            row.setEmployee(employee);
        }
        rowRepository.saveAll(rows);
        batch.setStatus(HrImportBatchStatus.VALIDATED);
        batch.setValidRows(valid);
        batch.setWarningRows(warning);
        batch.setInvalidRows(invalid);
        batch.setValidatedAt(nowUtc());
        batch.setIssueSummary(json(Map.of("valid", valid, "warning", warning, "invalid", invalid)));
        touch(batch, actor);
        batchRepository.save(batch);
        audit(actor, "SALARY_RAISE_IMPORT_VALIDATED", "HR_IMPORT_BATCH", batch.getId(), null,
                Map.of("validRows", valid, "warningRows", warning, "invalidRows", invalid));
        return HrSalaryRaiseDtos.BatchResponse.from(batch);
    }

    @Transactional(readOnly = true)
    public HrSalaryRaiseDtos.PreviewResponse preview(String batchId, int page, int size) {
        HrExcelImportBatch batch = requireBatch(batchId);
        requireSalaryBatch(batch);
        var result = rowRepository.findByBatch_IdOrderByRowNumber(batchId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)));
        List<HrSalaryRaiseDtos.PreviewRow> rows = result.getContent().stream()
                .map(value -> new HrSalaryRaiseDtos.PreviewRow(value.getRowNumber(), value.getRowStatus(),
                        value.getNormalizedPayload() == null ? null : rowData(value), issues(value.getIssueCodes())))
                .toList();
        return new HrSalaryRaiseDtos.PreviewResponse(HrSalaryRaiseDtos.BatchResponse.from(batch), rows,
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrSalaryRaiseDtos.BatchResponse> imports(int page, int size) {
        return HrPageResponse.from(batchRepository.findByImportTypeOrderByCreatedAtDesc(
                HrImportType.SALARY_RAISE,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50))),
                HrSalaryRaiseDtos.BatchResponse::from);
    }

    @Transactional
    public HrSalaryRaiseDtos.BatchResponse confirm(String batchId, String confirmationKey,
                                                    boolean acceptWarnings, HrImportActor actor) {
        requireApprover(actor);
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireSalaryBatch(batch);
        if (batch.getStatus() == HrImportBatchStatus.CONFIRMED) {
            if (Objects.equals(batch.getConfirmationKey(), confirmationKey)) {
                return HrSalaryRaiseDtos.BatchResponse.from(batch);
            }
            throw HrApiException.conflict("SALARY_RAISE_BATCH_ALREADY_CONFIRMED", "Batch nâng lương đã được xác nhận.");
        }
        if (batch.getStatus() != HrImportBatchStatus.VALIDATED) {
            throw HrApiException.conflict("SALARY_RAISE_BATCH_NOT_VALIDATED", "Batch nâng lương chưa được kiểm tra.");
        }
        if (batch.getInvalidRows() > 0) {
            throw HrApiException.conflict("SALARY_RAISE_INVALID_ROWS", "Batch còn dòng lỗi nên chưa thể xác nhận.");
        }
        if (batch.getWarningRows() > 0 && !acceptWarnings) {
            throw HrApiException.conflict("SALARY_RAISE_WARNINGS_REQUIRE_ACK",
                    "Bạn phải xác nhận đã đọc cảnh báo trước khi áp dụng.");
        }
        String safeKey = requiredText(confirmationKey, "Confirmation key là bắt buộc.");
        batchRepository.findByConfirmationKey(safeKey).filter(value -> !value.getId().equals(batchId))
                .ifPresent(value -> { throw HrApiException.conflict("CONFIRMATION_KEY_ALREADY_USED",
                        "Confirmation key đã được dùng cho batch khác."); });
        requirePayload(batch);

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        Set<String> codes = rows.stream().map(this::rowData).map(HrSalaryRaiseDtos.RowData::employeeCode)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, HrEmployee> employees = employeeRepository.findAllByEmployeeCodeInForUpdate(codes).stream()
                .collect(Collectors.toMap(HrEmployee::getEmployeeCode, Function.identity()));
        if (employees.size() != codes.size()) {
            throw HrApiException.conflict("SALARY_RAISE_STALE_DATA",
                    "Dữ liệu nhân sự đã thay đổi sau lúc preview; vui lòng kiểm tra lại batch.");
        }
        Map<String, List<HrEmployeeSalaryChange>> timelineMap = timelines(employees.values());
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDateTime now = nowUtc();
        List<HrEmployeeSalaryChange> changes = new ArrayList<>();
        for (HrExcelImportRow row : rows) {
            HrSalaryRaiseDtos.RowData data = rowData(row);
            HrEmployee employee = employees.get(data.employeeCode());
            Compensation before = compensationAt(employee, data.effectiveDate().minusDays(1),
                    timelineMap.getOrDefault(employee.getId(), List.of()));
            if (!moneyEquals(before.baseSalary(), data.currentBaseSalary())
                    || !moneyEquals(before.allowance(), data.currentAllowance())) {
                throw HrApiException.conflict("SALARY_RAISE_STALE_DATA",
                        data.employeeCode() + " – Lương hoặc phụ cấp trong DB đã thay đổi; batch chưa được áp dụng.");
            }
            String idempotency = idempotencyKey(employee.getId(), data);
            if (salaryChangeRepository.existsByIdempotencyKey(idempotency)) {
                throw HrApiException.conflict("SALARY_RAISE_DUPLICATE", data.employeeCode()
                        + " – Đợt nâng lương này đã tồn tại.");
            }
            HrEmployeeSalaryChange change = new HrEmployeeSalaryChange();
            change.setEmployee(employee);
            change.setImportBatch(batch);
            change.setSourceRowNumber(row.getRowNumber());
            change.setEffectiveDate(data.effectiveDate());
            change.setOldBaseSalary(zero(data.currentBaseSalary()));
            change.setNewBaseSalary(zero(data.newBaseSalary()));
            change.setOldAllowance(zero(data.currentAllowance()));
            change.setNewAllowance(zero(data.newAllowance()));
            change.setOldGrade(data.currentGrade());
            change.setNewGrade(data.newGrade());
            change.setSalaryScaleCode(data.salaryScaleCode());
            change.setReviewCycleMonths(data.reviewCycleMonths());
            change.setNextReviewDate(data.nextReviewDate());
            change.setIdempotencyKey(idempotency);
            if (!data.effectiveDate().isAfter(today)) {
                change.setStatus(HrSalaryChangeStatus.APPLIED);
                change.setAppliedAt(now);
                change.setAppliedByActor(actor.subject());
            } else {
                change.setStatus(HrSalaryChangeStatus.SCHEDULED);
            }
            initialize(change, actor);
            changes.add(change);
            row.setEmployee(employee);
            row.setRowStatus(HrImportRowStatus.IMPORTED);
        }
        salaryChangeRepository.saveAll(changes);
        rowRepository.saveAll(rows);
        entityManager.flush();
        for (HrEmployee employee : employees.values()) refreshSnapshot(employee, actor, null, today);

        batch.setStatus(HrImportBatchStatus.CONFIRMED);
        batch.setImportedRows(rows.size());
        batch.setConfirmationKey(safeKey);
        batch.setConfirmedAt(now);
        batch.setConfirmedByActor(actor.subject());
        touch(batch, actor);
        batchRepository.save(batch);
        audit(actor, "SALARY_RAISE_IMPORT_CONFIRMED", "HR_IMPORT_BATCH", batch.getId(), safeKey,
                Map.of("rowCount", rows.size(), "scheduledRows",
                        changes.stream().filter(value -> value.getStatus() == HrSalaryChangeStatus.SCHEDULED).count()));
        return HrSalaryRaiseDtos.BatchResponse.from(batch);
    }

    @Transactional
    public HrSalaryRaiseDtos.BatchResponse rollback(String batchId, String reason, HrImportActor actor) {
        requireApprover(actor);
        String safeReason = requiredText(reason, "Lý do rollback là bắt buộc.");
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireSalaryBatch(batch);
        if (batch.getStatus() == HrImportBatchStatus.ROLLED_BACK) {
            return HrSalaryRaiseDtos.BatchResponse.from(batch);
        }
        if (batch.getStatus() != HrImportBatchStatus.CONFIRMED) {
            throw HrApiException.conflict("SALARY_RAISE_BATCH_NOT_CONFIRMED",
                    "Chỉ batch nâng lương đã xác nhận mới có thể rollback.");
        }
        List<HrEmployeeSalaryChange> changes = salaryChangeRepository
                .findAllByImportBatch_IdOrderBySourceRowNumber(batchId);
        for (HrEmployeeSalaryChange change : changes) {
            if (salaryChangeRepository.existsActiveAfter(change.getEmployee().getId(), change.getEffectiveDate())) {
                throw HrApiException.conflict("SALARY_RAISE_ROLLBACK_HAS_LATER_CHANGE",
                        change.getEmployee().getEmployeeCode()
                                + " đã có thay đổi lương về sau; phải rollback đợt mới hơn trước.");
            }
        }
        LocalDateTime now = nowUtc();
        Map<String, Compensation> fallback = new HashMap<>();
        Set<HrEmployee> affected = new LinkedHashSet<>();
        for (HrEmployeeSalaryChange change : changes) {
            change.setStatus(HrSalaryChangeStatus.ROLLED_BACK);
            change.setRolledBackAt(now);
            change.setRolledBackByActor(actor.subject());
            change.setRollbackReason(safeReason);
            touch(change, actor);
            fallback.put(change.getEmployee().getId(), new Compensation(change.getOldBaseSalary(),
                    change.getOldAllowance(), change.getOldGrade(), change.getSalaryScaleCode(), null, null, null));
            affected.add(change.getEmployee());
        }
        salaryChangeRepository.saveAll(changes);
        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        rows.forEach(value -> value.setRowStatus(HrImportRowStatus.ROLLED_BACK));
        rowRepository.saveAll(rows);
        entityManager.flush();
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        for (HrEmployee employee : affected) {
            refreshSnapshot(employee, actor, fallback.get(employee.getId()), today);
        }

        batch.setStatus(HrImportBatchStatus.ROLLED_BACK);
        batch.setImportedRows(0);
        batch.setRolledBackAt(now);
        batch.setRolledBackByActor(actor.subject());
        touch(batch, actor);
        batchRepository.save(batch);
        audit(actor, "SALARY_RAISE_IMPORT_ROLLED_BACK", "HR_IMPORT_BATCH", batch.getId(),
                batch.getConfirmationKey(), Map.of("rowCount", changes.size(), "reason", safeReason));
        return HrSalaryRaiseDtos.BatchResponse.from(batch);
    }

    @Transactional
    public void deleteImport(String batchId, HrImportActor actor) {
        requireApprover(actor);
        HrExcelImportBatch batch = lockedBatch(batchId);
        requireSalaryBatch(batch);
        if (batch.getStatus() == HrImportBatchStatus.CONFIRMED) {
            throw HrApiException.conflict("SALARY_RAISE_DELETE_REQUIRES_ROLLBACK",
                    "Batch đã áp dụng lương; phải rollback trước khi xóa file import.");
        }

        List<HrEmployeeSalaryChange> changes = salaryChangeRepository
                .findAllByImportBatch_IdOrderBySourceRowNumber(batchId);
        if (changes.stream().anyMatch(change -> change.getStatus() != HrSalaryChangeStatus.ROLLED_BACK)) {
            throw HrApiException.conflict("SALARY_RAISE_DELETE_HAS_ACTIVE_CHANGES",
                    "Batch còn thay đổi lương đang hiệu lực nên không thể xóa.");
        }

        // A rolled-back salary change is permanent audit/history. Detach only
        // the disposable import batch so deleting the preview cannot erase it.
        for (HrEmployeeSalaryChange change : changes) {
            change.setImportBatch(null);
            touch(change, actor);
        }
        salaryChangeRepository.saveAll(changes);

        List<HrExcelImportRow> rows = rowRepository.findAllByBatch_IdOrderByRowNumber(batchId);
        rows.forEach(entityManager::remove);
        entityManager.flush();
        String sourceFileName = batch.getSourceFileName();
        HrImportBatchStatus deletedStatus = batch.getStatus();
        entityManager.remove(batch);
        entityManager.flush();

        audit(actor, "SALARY_RAISE_IMPORT_DELETED", "HR_IMPORT_BATCH", batchId, null,
                Map.of("sourceFileName", sourceFileName == null ? "" : sourceFileName,
                        "previousStatus", deletedStatus.name(),
                        "deletedPreviewRows", rows.size(),
                        "preservedSalaryHistoryRows", changes.size()));
    }

    @Transactional
    public int applyDueScheduled(LocalDate today, HrImportActor actor) {
        List<HrEmployeeSalaryChange> due = salaryChangeRepository
                .findByStatusAndEffectiveDateLessThanEqual(HrSalaryChangeStatus.SCHEDULED, today);
        if (due.isEmpty()) return 0;
        LocalDateTime now = nowUtc();
        Set<HrEmployee> employees = new LinkedHashSet<>();
        for (HrEmployeeSalaryChange change : due) {
            change.setStatus(HrSalaryChangeStatus.APPLIED);
            change.setAppliedAt(now);
            change.setAppliedByActor(actor.subject());
            touch(change, actor);
            employees.add(change.getEmployee());
        }
        salaryChangeRepository.saveAll(due);
        entityManager.flush();
        for (HrEmployee employee : employees) refreshSnapshot(employee, actor, null, today);
        audit(actor, "SALARY_RAISE_SCHEDULED_APPLIED", "HR_SALARY_CHANGE", null, null,
                Map.of("rowCount", due.size(), "effectiveThrough", today.toString()));
        return due.size();
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrSalaryRaiseDtos.HistoryResponse> history(String employeeId, int page, int size) {
        if (!employeeRepository.existsById(employeeId)) {
            throw HrApiException.notFound("HR_EMPLOYEE_NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
        }
        return HrPageResponse.from(salaryChangeRepository.findByEmployee_Id(employeeId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50),
                        Sort.by(Sort.Order.desc("effectiveDate"), Sort.Order.desc("createdAt")))),
                HrSalaryRaiseDtos.HistoryResponse::from);
    }

    @Transactional(readOnly = true)
    public Map<String, Compensation> compensationAt(Collection<HrEmployee> employees, LocalDate asOf) {
        if (employees.isEmpty()) return Map.of();
        Map<String, List<HrEmployeeSalaryChange>> timelines = timelines(employees);
        Map<String, Compensation> result = new HashMap<>();
        for (HrEmployee employee : employees) {
            result.put(employee.getId(), compensationAt(employee, asOf,
                    timelines.getOrDefault(employee.getId(), List.of())));
        }
        return result;
    }

    private Map<String, List<HrEmployeeSalaryChange>> timelines(Collection<HrEmployee> employees) {
        Set<String> ids = employees.stream().map(HrEmployee::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return salaryChangeRepository.findActiveTimeline(ids).stream()
                .collect(Collectors.groupingBy(value -> value.getEmployee().getId(), LinkedHashMap::new,
                        Collectors.toList()));
    }

    private Compensation compensationAt(HrEmployee employee, LocalDate asOf,
                                        List<HrEmployeeSalaryChange> timeline) {
        HrEmployeeSalaryChange latest = null;
        for (HrEmployeeSalaryChange change : timeline) {
            if (!change.getEffectiveDate().isAfter(asOf)) latest = change;
        }
        if (latest != null) return fromNew(latest);
        if (!timeline.isEmpty()) {
            HrEmployeeSalaryChange first = timeline.getFirst();
            return new Compensation(first.getOldBaseSalary(), first.getOldAllowance(), first.getOldGrade(),
                    first.getSalaryScaleCode(), null, null, null);
        }
        HrEmployeeEmployment employment = employee.getEmployment();
        return employment == null
                ? new Compensation(null, null, null, null, null, null, null)
                : new Compensation(employment.getBaseSalary(), employment.getAllowance(), employment.getSalaryGrade(),
                employment.getSalaryScaleCode(), employment.getSalaryReviewCycleMonths(),
                employment.getLastSalaryRaiseDate(), employment.getNextSalaryReviewDate());
    }

    private void refreshSnapshot(HrEmployee employee, HrImportActor actor, Compensation fallback,
                                 LocalDate snapshotDate) {
        HrEmployeeEmployment employment = employee.getEmployment();
        if (employment == null) return;
        List<HrEmployeeSalaryChange> timeline = salaryChangeRepository.findActiveTimeline(List.of(employee.getId()));
        HrEmployeeSalaryChange latest = null;
        for (HrEmployeeSalaryChange change : timeline) {
            if (!change.getEffectiveDate().isAfter(snapshotDate)) latest = change;
        }
        Compensation value = latest == null ? fallback : fromNew(latest);
        if (value == null) return;
        employment.setBaseSalary(value.baseSalary());
        employment.setAllowance(value.allowance());
        employment.setSalaryGrade(value.grade());
        employment.setSalaryScaleCode(value.scaleCode());
        employment.setSalaryReviewCycleMonths(value.reviewCycleMonths());
        employment.setLastSalaryRaiseDate(value.effectiveDate());
        employment.setNextSalaryReviewDate(value.nextReviewDate());
        touch(employment, actor);
        employmentRepository.save(employment);
    }

    private static Compensation fromNew(HrEmployeeSalaryChange value) {
        return new Compensation(value.getNewBaseSalary(), value.getNewAllowance(), value.getNewGrade(),
                value.getSalaryScaleCode(), value.getReviewCycleMonths(), value.getEffectiveDate(),
                value.getNextReviewDate());
    }

    private HrExcelImportBatch lockedBatch(String id) {
        return batchRepository.findLockedById(id)
                .orElseThrow(() -> HrApiException.notFound("SALARY_RAISE_BATCH_NOT_FOUND",
                        "Không tìm thấy batch nâng lương."));
    }

    private HrExcelImportBatch requireBatch(String id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("SALARY_RAISE_BATCH_NOT_FOUND",
                        "Không tìm thấy batch nâng lương."));
    }

    private static void requireSalaryBatch(HrExcelImportBatch batch) {
        if (batch.getImportType() != HrImportType.SALARY_RAISE) {
            throw HrApiException.badRequest("SALARY_RAISE_BATCH_TYPE_INVALID", "Batch không thuộc chế độ nâng lương.");
        }
    }

    private static void requirePayload(HrExcelImportBatch batch) {
        if (batch.getPayloadPurgedAt() != null) {
            throw HrApiException.conflict("PAYLOAD_PURGED", "Dữ liệu chi tiết của batch đã hết thời hạn lưu.");
        }
    }

    private HrSalaryRaiseDtos.RowData rowData(HrExcelImportRow row) {
        try {
            return jsonCodec.read(row.getNormalizedPayload(), HrSalaryRaiseDtos.RowData.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể đọc staging nâng lương.", exception);
        }
    }

    private List<HrImportIssue> issues(String value) {
        if (value == null || value.isBlank()) return new ArrayList<>();
        try {
            return jsonCodec.read(value, new TypeReference<List<HrImportIssue>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể đọc lỗi staging nâng lương.", exception);
        }
    }

    private String json(Object value) {
        try {
            return jsonCodec.write(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi dữ liệu nâng lương.", exception);
        }
    }

    private static HrImportRowStatus status(List<HrImportIssue> issues) {
        if (issues.stream().anyMatch(value -> value.severity() == HrImportIssueSeverity.ERROR)) {
            return HrImportRowStatus.INVALID;
        }
        if (!issues.isEmpty()) return HrImportRowStatus.WARNING;
        return HrImportRowStatus.VALID;
    }

    private static HrImportIssue error(HrImportIssueCode code, String field, String message) {
        return new HrImportIssue(code, HrImportIssueSeverity.ERROR, "", field, message);
    }

    private static HrImportIssue warning(HrImportIssueCode code, String field, String message) {
        return new HrImportIssue(code, HrImportIssueSeverity.WARNING, "", field, message);
    }

    private static String mismatchMessage(String label, BigDecimal file, BigDecimal database) {
        return label + " trong file là " + displayMoney(file) + " nhưng mức đang có hiệu lực trong hệ thống là "
                + displayMoney(database) + ".";
    }

    private static String displayMoney(BigDecimal value) {
        return value == null ? "trống" : String.format(Locale.forLanguageTag("vi-VN"), "%,.0f", value);
    }

    private static String idempotencyKey(String employeeId, HrSalaryRaiseDtos.RowData data) {
        return "SALARY:" + sha256(employeeId + ":" + data.effectiveDate() + ":" + data.newBaseSalary()
                + ":" + data.newAllowance() + ":" + data.newGrade());
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static boolean moneyEquals(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) == 0;
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2) : value.setScale(2);
    }

    private static String normalizedName(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    private static String safeFileName(String value) {
        String name = value == null ? "salary-raise.xlsx" : value.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        return name.isBlank() ? "salary-raise.xlsx" : name.substring(0, Math.min(name.length(), 255));
    }

    private static String requiredText(String value, String message) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank()) throw HrApiException.badRequest("REQUIRED_VALUE", message);
        return normalized;
    }

    private static void requireApprover(HrImportActor actor) {
        if (!Set.of("ADMIN", "MANAGER").contains(actor.role())) {
            throw HrApiException.forbidden("SALARY_RAISE_APPROVER_REQUIRED",
                    "Chỉ ADMIN hoặc MANAGER được xác nhận, rollback hoặc xóa file nâng lương.");
        }
    }

    private void audit(HrImportActor actor, String action, String type, String id,
                       String correlationId, Map<String, ?> metadata) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(type);
        event.setEntityId(id);
        event.setCorrelationId(correlationId == null ? null
                : correlationId.substring(0, Math.min(64, correlationId.length())));
        event.setSanitizedMetadata(json(metadata));
        auditRepository.save(event);
    }

    private static void initialize(HrAuditable value, HrImportActor actor) {
        value.setCreatedByActor(actor.subject());
        value.setUpdatedByActor(actor.subject());
    }

    private static void touch(HrAuditable value, HrImportActor actor) {
        value.setUpdatedByActor(actor.subject());
    }

    private static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    public record Compensation(BigDecimal baseSalary, BigDecimal allowance, String grade, String scaleCode,
                               Integer reviewCycleMonths, LocalDate effectiveDate, LocalDate nextReviewDate) {
        public BigDecimal total() {
            return zero(baseSalary).add(zero(allowance));
        }
    }
}

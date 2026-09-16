package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrNightRewardDtos;
import com.booking.system.hr.entity.*;
import com.booking.system.hr.enums.*;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Phase 0–3 of the night-reward program. This aggregate deliberately stops at
 * draft entitlements: Payroll, PDF and Telegram must only consume a separate
 * approved allocation in a later phase.
 */
@Service
@RequiredArgsConstructor
public class HrNightRewardService {
    private static final BigDecimal PERIODIC_MONTH_CREDIT = new BigDecimal("500000");
    private static final BigDecimal LOYALTY_MONTH_CREDIT = new BigDecimal("1000000");
    private static final BigDecimal PERIODIC_PAYOUT = new BigDecimal("6000000");
    private static final BigDecimal LOYALTY_PAYOUT = new BigDecimal("24000000");
    private static final int PERIODIC_CYCLE_MONTHS = 12;
    private static final int LOYALTY_CYCLE_MONTHS = 24;

    private final HrNightRewardProgramRepository programRepository;
    private final HrNightRewardMonthlyQualificationRepository qualificationRepository;
    private final HrNightRewardQualificationShiftRepository qualificationShiftRepository;
    private final HrNightRewardExceptionRepository exceptionRepository;
    private final HrNightRewardLedgerEntryRepository ledgerRepository;
    private final HrNightRewardEntitlementRepository entitlementRepository;
    private final HrProductionAttendanceImportRepository attendanceImportRepository;
    private final HrProductionAttendanceShiftRepository attendanceShiftRepository;
    private final HrAttendanceShiftPolicyRepository shiftPolicyRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrAuditEventRepository auditRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public HrNightRewardDtos.MonthResponse preview(String monthValue) {
        return buildMonth(monthValue).response();
    }

    @Transactional
    public HrNightRewardDtos.FinalizeMonthResponse finalizeMonth(String monthValue,
                                                                  HrNightRewardDtos.FinalizeMonthRequest request,
                                                                  HrImportActor actor) {
        requireAdmin(actor, "Chỉ quản trị viên được chốt thưởng ca đêm.");
        MonthBuild build = buildMonth(monthValue);
        if (!build.response().readyToFinalize()) {
            throw HrApiException.conflict("NIGHT_REWARD_MONTH_NOT_READY",
                    "Chưa thể chốt thưởng tháng: " + String.join("; ", build.response().blockers()));
        }

        int created = 0;
        int unchanged = 0;
        int qualified = 0;
        int exceptional = 0;
        List<String> entitlementIds = new ArrayList<>();
        for (Candidate candidate : build.candidates()) {
            HrNightRewardMonthlyQualification latest = latestQualification(build.program().getId(), candidate.employee().getId(), build.month());
            if (latest != null && latest.getStatus() != HrNightRewardMonthlyStatus.STALE) {
                unchanged++;
                if (isQualified(latest.getStatus())) qualified++;
                if (latest.getStatus() == HrNightRewardMonthlyStatus.QUALIFIED_EXCEPTION) exceptional++;
                continue;
            }
            HrNightRewardMonthlyQualification qualification = new HrNightRewardMonthlyQualification();
            qualification.setProgramId(build.program().getId());
            qualification.setEmployeeId(candidate.employee().getId());
            qualification.setEmployeeCode(candidate.employee().getEmployeeCode());
            qualification.setEmployeeName(candidate.employee().getFullName());
            qualification.setAttendanceMonth(build.month());
            qualification.setRevision(latest == null ? 1 : latest.getRevision() + 1);
            qualification.setStatus(candidate.status());
            qualification.setActualNightShiftCount(candidate.eligibleShifts().size());
            qualification.setRequiredNightShiftCount(build.program().getQualifyingNightThreshold());
            qualification.setQualificationReason(candidate.reason());
            qualification.setSourceSnapshotJson(writeJson(candidate.snapshot()));
            qualification.setFinalizedAt(now());
            qualification.setFinalizedByActor(actor.subject());
            initialize(qualification, actor);
            qualificationRepository.save(qualification);
            persistSources(qualification, candidate.eligibleShifts(), actor);
            created++;

            if (isQualified(candidate.status())) {
                qualified++;
                if (candidate.status() == HrNightRewardMonthlyStatus.QUALIFIED_EXCEPTION) exceptional++;
                entitlementIds.addAll(creditAndMature(build.program(), qualification, actor, request.reason().trim()));
            }
            audit(actor, "FINALIZE_NIGHT_REWARD_MONTH", "HR_NIGHT_REWARD_MONTH", qualification.getId(),
                    List.of("status", "actualNightShiftCount", "revision"),
                    Map.of("month", build.month(), "employeeCode", qualification.getEmployeeCode(), "reason", request.reason().trim()));
        }
        return new HrNightRewardDtos.FinalizeMonthResponse(build.month(), created, unchanged, qualified, exceptional,
                List.copyOf(entitlementIds));
    }

    @Transactional(readOnly = true)
    public List<HrNightRewardDtos.ExceptionResponse> exceptions(String monthValue) {
        YearMonth month = parseMonth(monthValue);
        HrNightRewardProgram program = effectiveProgram(month);
        return exceptionRepository.findByProgramIdAndAttendanceMonthOrderByCreatedAtDesc(program.getId(), month.toString())
                .stream().map(this::exceptionResponse).toList();
    }

    @Transactional
    public HrNightRewardDtos.ExceptionResponse createException(HrNightRewardDtos.CreateExceptionRequest request,
                                                                HrImportActor actor) {
        YearMonth month = parseMonth(request.attendanceMonth());
        HrNightRewardProgram program = effectiveProgram(month);
        HrEmployee employee = employeeByCode(request.employeeCode());
        HrNightRewardException value = new HrNightRewardException();
        value.setProgramId(program.getId());
        value.setEmployeeId(employee.getId());
        value.setEmployeeCode(employee.getEmployeeCode());
        value.setAttendanceMonth(month.toString());
        value.setExceptionType(request.exceptionType());
        value.setReason(request.reason().trim());
        value.setEvidenceReference(blankToNull(request.evidenceReference()));
        initialize(value, actor);
        exceptionRepository.save(value);
        audit(actor, "CREATE_NIGHT_REWARD_EXCEPTION", "HR_NIGHT_REWARD_EXCEPTION", value.getId(),
                List.of("employeeCode", "month", "exceptionType"), Map.of("reason", value.getReason()));
        return exceptionResponse(value);
    }

    @Transactional
    public HrNightRewardDtos.ExceptionResponse approveException(String id, HrNightRewardDtos.ReviewExceptionRequest request,
                                                                 HrImportActor actor) {
        requireAdmin(actor, "Chỉ quản trị viên được duyệt ngoại lệ thưởng ca đêm.");
        HrNightRewardException value = exception(id);
        if (value.getStatus() != HrNightRewardExceptionStatus.DRAFT) {
            throw HrApiException.conflict("NIGHT_REWARD_EXCEPTION_NOT_DRAFT", "Chỉ ngoại lệ đang chờ duyệt mới có thể duyệt.");
        }
        value.setStatus(HrNightRewardExceptionStatus.APPROVED);
        value.setReviewedAt(now());
        value.setReviewedByActor(actor.subject());
        value.setReviewReason(request.reason().trim());
        touch(value, actor);
        exceptionRepository.save(value);
        audit(actor, "APPROVE_NIGHT_REWARD_EXCEPTION", "HR_NIGHT_REWARD_EXCEPTION", value.getId(),
                List.of("status", "review"), Map.of("reason", value.getReviewReason()));
        return exceptionResponse(value);
    }

    @Transactional
    public HrNightRewardDtos.ExceptionResponse rejectException(String id, HrNightRewardDtos.ReviewExceptionRequest request,
                                                                HrImportActor actor) {
        requireAdmin(actor, "Chỉ quản trị viên được từ chối ngoại lệ thưởng ca đêm.");
        HrNightRewardException value = exception(id);
        if (value.getStatus() != HrNightRewardExceptionStatus.DRAFT) {
            throw HrApiException.conflict("NIGHT_REWARD_EXCEPTION_NOT_DRAFT", "Chỉ ngoại lệ đang chờ duyệt mới có thể từ chối.");
        }
        value.setStatus(HrNightRewardExceptionStatus.REJECTED);
        value.setReviewedAt(now());
        value.setReviewedByActor(actor.subject());
        value.setReviewReason(request.reason().trim());
        touch(value, actor);
        exceptionRepository.save(value);
        audit(actor, "REJECT_NIGHT_REWARD_EXCEPTION", "HR_NIGHT_REWARD_EXCEPTION", value.getId(),
                List.of("status", "review"), Map.of("reason", value.getReviewReason()));
        return exceptionResponse(value);
    }

    @Transactional
    public HrNightRewardDtos.ExceptionResponse cancelException(String id, HrNightRewardDtos.ReviewExceptionRequest request,
                                                                HrImportActor actor) {
        HrNightRewardException value = exception(id);
        if (value.getStatus() == HrNightRewardExceptionStatus.CANCELLED) {
            throw HrApiException.conflict("NIGHT_REWARD_EXCEPTION_CANCELLED", "Ngoại lệ đã được hủy.");
        }
        if (!"ADMIN".equalsIgnoreCase(actor.role()) && !Objects.equals(value.getCreatedByActor(), actor.subject())) {
            throw new HrApiException(org.springframework.http.HttpStatus.FORBIDDEN,
                    "NIGHT_REWARD_EXCEPTION_CANCEL_FORBIDDEN", "Chỉ người tạo hoặc quản trị viên được hủy ngoại lệ.");
        }
        value.setStatus(HrNightRewardExceptionStatus.CANCELLED);
        value.setCancelledAt(now());
        value.setCancelledByActor(actor.subject());
        value.setCancellationReason(request.reason().trim());
        touch(value, actor);
        exceptionRepository.save(value);
        audit(actor, "CANCEL_NIGHT_REWARD_EXCEPTION", "HR_NIGHT_REWARD_EXCEPTION", value.getId(),
                List.of("status", "cancellation"), Map.of("reason", value.getCancellationReason()));
        return exceptionResponse(value);
    }

    @Transactional(readOnly = true)
    public HrNightRewardDtos.EmployeeTimelineResponse employeeTimeline(String employeeCode) {
        HrEmployee employee = employeeByCode(employeeCode);
        HrNightRewardProgram program = effectiveProgram(YearMonth.now(ZoneOffset.UTC));
        List<HrNightRewardMonthlyQualification> all = qualificationRepository
                .findByProgramIdAndEmployeeIdOrderByAttendanceMonthAscRevisionAsc(program.getId(), employee.getId());
        List<HrNightRewardMonthlyQualification> current = currentQualifications(all);
        List<HrNightRewardDtos.QualificationResponse> rows = all.stream().map(this::qualificationResponse).toList();
        return new HrNightRewardDtos.EmployeeTimelineResponse(employee.getEmployeeCode(), employee.getFullName(),
                programResponse(program), progress(program, employee.getId(), current), rows,
                entitlementRepository.findByProgramIdAndEmployeeIdAndStatus(program.getId(), employee.getId(),
                                HrNightRewardEntitlementStatus.DRAFT)
                        .stream().map(this::entitlementResponse).toList());
    }

    /** Called before an attendance import becomes editable/deletable. */
    @Transactional
    public void markStaleForAttendanceImport(String importId, HrImportActor actor, String reason) {
        List<HrNightRewardQualificationShift> sources = qualificationShiftRepository.findBySourceImportIdIn(List.of(importId));
        if (sources.isEmpty()) return;
        Set<String> qualificationIds = sources.stream().map(HrNightRewardQualificationShift::getQualificationId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (String qualificationId : qualificationIds) {
            HrNightRewardMonthlyQualification qualification = qualificationRepository.findById(qualificationId).orElse(null);
            if (qualification == null || qualification.getStatus() == HrNightRewardMonthlyStatus.STALE) continue;
            HrNightRewardMonthlyStatus before = qualification.getStatus();
            qualification.setStatus(HrNightRewardMonthlyStatus.STALE);
            qualification.setStaleAt(now());
            qualification.setStaleByActor(actor.subject());
            qualification.setStaleReason(reason);
            touch(qualification, actor);
            qualificationRepository.save(qualification);
            reverseCredits(qualification, actor, reason);
            entitlementRepository.findByProgramIdAndEmployeeIdAndStatus(qualification.getProgramId(), qualification.getEmployeeId(),
                            HrNightRewardEntitlementStatus.DRAFT)
                    .forEach(entitlement -> {
                        entitlement.setStatus(HrNightRewardEntitlementStatus.STALE);
                        touch(entitlement, actor);
                        entitlementRepository.save(entitlement);
                    });
            audit(actor, "STALE_NIGHT_REWARD_MONTH", "HR_NIGHT_REWARD_MONTH", qualification.getId(),
                    List.of("status", "staleReason"), Map.of("from", before.name(), "reason", reason));
        }
    }

    private MonthBuild buildMonth(String monthValue) {
        YearMonth month = parseMonth(monthValue);
        HrNightRewardProgram program = effectiveProgram(month);
        String monthText = month.toString();
        List<HrProductionAttendanceImport> confirmedImports = attendanceImportRepository
                .findByAttendanceMonthAndStatusOrderByCreatedAtAsc(monthText, HrAttendanceImportStatus.CONFIRMED);
        List<HrProductionAttendanceImport> previewImports = attendanceImportRepository
                .findByAttendanceMonthAndStatusOrderByCreatedAtAsc(monthText, HrAttendanceImportStatus.PREVIEWED);
        List<String> blockers = new ArrayList<>();
        if (confirmedImports.isEmpty()) blockers.add("Chưa có file ca sản xuất đã chốt trong tháng.");
        if (!previewImports.isEmpty()) blockers.add("Còn " + previewImports.size() + " file chấm công chưa chốt.");

        List<HrProductionAttendanceShift> shifts = attendanceShiftRepository
                .findActiveByAttendanceMonthAndImportStatus(monthText, HrAttendanceImportStatus.CONFIRMED);
        Map<String, Long> dailyCounts = shifts.stream().collect(Collectors.groupingBy(
                item -> item.getEmployeeCode() + "|" + item.getWorkDate(), Collectors.counting()));
        long duplicates = dailyCounts.values().stream().filter(value -> value > 1).count();
        if (duplicates > 0) blockers.add("Có " + duplicates + " ngày công trùng giữa các file; cần đối soát trước khi xét thưởng.");
        if (shifts.stream().anyMatch(item -> item.getStatus() == HrProductionAttendanceShiftStatus.NEEDS_REVIEW)) {
            blockers.add("Còn ca cần kiểm tra trong dữ liệu đã chốt.");
        }

        Map<String, HrAttendanceShiftPolicy> policies = shiftPolicyRepository.findAllByOrderByPolicyGroupAscPriorityDescCodeAsc()
                .stream().collect(Collectors.toMap(HrAttendanceShiftPolicy::getId, Function.identity()));
        Map<String, HrEmployee> employees = employeeRepository.findAllByEmployeeCodeIn(
                        shifts.stream().map(HrProductionAttendanceShift::getEmployeeCode).distinct().toList())
                .stream().collect(Collectors.toMap(HrEmployee::getEmployeeCode, Function.identity()));
        Map<String, List<HrProductionAttendanceShift>> byEmployee = shifts.stream()
                .filter(item -> item.getPolicyGroup() == program.getEligiblePolicyGroup())
                .collect(Collectors.groupingBy(HrProductionAttendanceShift::getEmployeeCode, TreeMap::new, Collectors.toList()));
        List<String> employeeIds = employees.values().stream().map(HrEmployee::getId).toList();
        Map<String, HrNightRewardException> approvedExceptions = (employeeIds.isEmpty() ? List.<HrNightRewardException>of()
                : exceptionRepository.findByProgramIdAndEmployeeIdInAndAttendanceMonthOrderByCreatedAtDesc(
                        program.getId(), employeeIds, monthText))
                .stream().filter(item -> item.getStatus() == HrNightRewardExceptionStatus.APPROVED)
                .collect(Collectors.toMap(HrNightRewardException::getEmployeeId, Function.identity(), (left, right) -> left));

        List<Candidate> candidates = new ArrayList<>();
        for (Map.Entry<String, List<HrProductionAttendanceShift>> entry : byEmployee.entrySet()) {
            HrEmployee employee = employees.get(entry.getKey());
            if (employee == null) continue;
            List<HrProductionAttendanceShift> eligibleShifts = entry.getValue().stream()
                    .filter(item -> item.getStatus() == HrProductionAttendanceShiftStatus.CONFIRMED)
                    .filter(item -> item.getWorkValue() != null && item.getWorkValue().signum() > 0)
                    .filter(item -> {
                        HrAttendanceShiftPolicy policy = policies.get(item.getShiftPolicyId());
                        return policy != null && policy.isCountsTowardNightReward();
                    })
                    .collect(Collectors.toMap(HrProductionAttendanceShift::getWorkDate, Function.identity(), (left, right) -> left,
                            TreeMap::new)).values().stream().toList();
            HrNightRewardException approved = approvedExceptions.get(employee.getId());
            HrNightRewardMonthlyStatus status;
            String reason;
            if (employee.getEmploymentStatus() != HrEmploymentStatus.ACTIVE) {
                status = HrNightRewardMonthlyStatus.EXCLUDED;
                reason = "Nhân viên không ở trạng thái đang làm việc trong hệ thống tại thời điểm chốt.";
            } else if (eligibleShifts.size() >= program.getQualifyingNightThreshold()) {
                status = HrNightRewardMonthlyStatus.QUALIFIED;
                reason = "Có " + eligibleShifts.size() + "/" + program.getQualifyingNightThreshold() + " ca đêm hợp lệ đã chốt.";
            } else if (approved != null) {
                status = HrNightRewardMonthlyStatus.QUALIFIED_EXCEPTION;
                reason = "Đạt ngoại lệ Công ty: " + approved.getExceptionType().name() + ".";
            } else {
                status = HrNightRewardMonthlyStatus.NOT_QUALIFIED;
                reason = "Có " + eligibleShifts.size() + "/" + program.getQualifyingNightThreshold() + " ca đêm hợp lệ đã chốt.";
            }
            candidates.add(new Candidate(employee, eligibleShifts, status, reason, approved != null,
                    Map.of("attendanceMonth", monthText, "programCode", program.getCode(), "actualNightShiftCount", eligibleShifts.size(),
                            "requiredNightShiftCount", program.getQualifyingNightThreshold(), "shiftIds", eligibleShifts.stream()
                                    .map(HrProductionAttendanceShift::getId).toList(), "sourceImportIds", eligibleShifts.stream()
                                    .map(HrProductionAttendanceShift::getImportId).distinct().toList())));
        }
        List<String> candidateEmployeeIds = candidates.stream().map(item -> item.employee().getId()).toList();
        Map<String, List<HrNightRewardMonthlyQualification>> history = (candidateEmployeeIds.isEmpty()
                ? List.<HrNightRewardMonthlyQualification>of()
                : qualificationRepository.findCurrentForEmployees(
                        program.getId(), candidateEmployeeIds, HrNightRewardMonthlyStatus.STALE))
                .stream().collect(Collectors.groupingBy(HrNightRewardMonthlyQualification::getEmployeeId));
        List<HrNightRewardDtos.MonthlyEmployeeResponse> employeeResponses = candidates.stream().map(candidate -> {
            HrNightRewardMonthlyQualification latest = latestQualification(program.getId(), candidate.employee().getId(), monthText);
            return new HrNightRewardDtos.MonthlyEmployeeResponse(candidate.employee().getEmployeeCode(), candidate.employee().getFullName(),
                    candidate.employee().getId(), candidate.eligibleShifts().size(), program.getQualifyingNightThreshold(), candidate.status(),
                    candidate.reason(), candidate.hasApprovedException(), latest == null ? null : latest.getStatus(),
                    latest == null ? null : latest.getRevision(), progress(program, candidate.employee().getId(),
                    currentQualifications(history.getOrDefault(candidate.employee().getId(), List.of()))),
                    candidate.eligibleShifts().stream().map(this::sourceResponse).toList());
        }).toList();
        int qualified = (int) candidates.stream().filter(value -> value.status() == HrNightRewardMonthlyStatus.QUALIFIED).count();
        int exceptional = (int) candidates.stream().filter(value -> value.status() == HrNightRewardMonthlyStatus.QUALIFIED_EXCEPTION).count();
        int notQualified = (int) candidates.stream().filter(value -> value.status() == HrNightRewardMonthlyStatus.NOT_QUALIFIED).count();
        return new MonthBuild(monthText, program, List.copyOf(candidates), new HrNightRewardDtos.MonthResponse(monthText,
                blockers.isEmpty(), List.copyOf(blockers), programResponse(program), candidates.size(), qualified, notQualified,
                exceptional, employeeResponses));
    }

    private List<String> creditAndMature(HrNightRewardProgram program, HrNightRewardMonthlyQualification qualification,
                                          HrImportActor actor, String reason) {
        List<String> entitlementIds = new ArrayList<>();
        entitlementIds.addAll(creditTrack(program, qualification, HrNightRewardTrack.PERIODIC_NIGHT,
                PERIODIC_MONTH_CREDIT, PERIODIC_CYCLE_MONTHS, PERIODIC_PAYOUT, actor, reason));
        entitlementIds.addAll(creditTrack(program, qualification, HrNightRewardTrack.LOYALTY_NIGHT,
                LOYALTY_MONTH_CREDIT, LOYALTY_CYCLE_MONTHS, LOYALTY_PAYOUT, actor, reason));
        return entitlementIds;
    }

    private List<String> creditTrack(HrNightRewardProgram program, HrNightRewardMonthlyQualification qualification,
                                     HrNightRewardTrack track, BigDecimal monthlyCredit, int requiredMonths,
                                     BigDecimal payout, HrImportActor actor, String reason) {
        if (ledgerRepository.findByQualificationIdAndTrackCodeAndEntryType(qualification.getId(), track,
                HrNightRewardLedgerEntryType.MONTH_CREDIT).isEmpty()) {
            HrNightRewardLedgerEntry credit = ledger(program, qualification, track, HrNightRewardLedgerEntryType.MONTH_CREDIT,
                    monthlyCredit, reason, actor);
            ledgerRepository.save(credit);
        }
        int qualifiedMonths = currentQualifications(qualificationRepository
                        .findByProgramIdAndEmployeeIdOrderByAttendanceMonthAscRevisionAsc(program.getId(), qualification.getEmployeeId()))
                .stream().filter(value -> isQualified(value.getStatus())).toList().size();
        if (qualifiedMonths == 0 || qualifiedMonths % requiredMonths != 0) return List.of();
        if (entitlementRepository.existsByProgramIdAndEmployeeIdAndTrackCodeAndQualifiedMonthsAtMaturityAndStatus(
                program.getId(), qualification.getEmployeeId(), track, qualifiedMonths, HrNightRewardEntitlementStatus.DRAFT)) {
            return List.of();
        }
        HrNightRewardLedgerEntry maturity = ledger(program, qualification, track, HrNightRewardLedgerEntryType.CYCLE_MATURED,
                payout, "Đủ " + requiredMonths + " tháng đạt điều kiện; chờ Finance duyệt.", actor);
        ledgerRepository.save(maturity);
        HrNightRewardEntitlement entitlement = new HrNightRewardEntitlement();
        entitlement.setProgramId(program.getId());
        entitlement.setEmployeeId(qualification.getEmployeeId());
        entitlement.setEmployeeCode(qualification.getEmployeeCode());
        entitlement.setTrackCode(track);
        entitlement.setQualifiedMonthsAtMaturity(qualifiedMonths);
        entitlement.setAmount(payout);
        entitlement.setSourceSnapshotJson(writeJson(Map.of("qualificationId", qualification.getId(), "attendanceMonth",
                qualification.getAttendanceMonth(), "qualifiedMonths", qualifiedMonths, "track", track.name())));
        initialize(entitlement, actor);
        entitlementRepository.save(entitlement);
        audit(actor, "MATURE_NIGHT_REWARD_ENTITLEMENT", "HR_NIGHT_REWARD_ENTITLEMENT", entitlement.getId(),
                List.of("track", "qualifiedMonths", "amount"), Map.of("reason", reason));
        return List.of(entitlement.getId());
    }

    private HrNightRewardLedgerEntry ledger(HrNightRewardProgram program, HrNightRewardMonthlyQualification qualification,
                                             HrNightRewardTrack track, HrNightRewardLedgerEntryType entryType,
                                             BigDecimal amount, String reason, HrImportActor actor) {
        HrNightRewardLedgerEntry entry = new HrNightRewardLedgerEntry();
        entry.setProgramId(program.getId());
        entry.setEmployeeId(qualification.getEmployeeId());
        entry.setEmployeeCode(qualification.getEmployeeCode());
        entry.setQualificationId(qualification.getId());
        entry.setTrackCode(track);
        entry.setEntryType(entryType);
        entry.setAmount(amount);
        entry.setReason(reason);
        initialize(entry, actor);
        return entry;
    }

    private void reverseCredits(HrNightRewardMonthlyQualification qualification, HrImportActor actor, String reason) {
        HrNightRewardProgram program = programRepository.findById(qualification.getProgramId()).orElse(null);
        if (program == null) return;
        for (HrNightRewardTrack track : HrNightRewardTrack.values()) {
            boolean credited = !ledgerRepository.findByQualificationIdAndTrackCodeAndEntryType(qualification.getId(), track,
                    HrNightRewardLedgerEntryType.MONTH_CREDIT).isEmpty();
            boolean reversed = !ledgerRepository.findByQualificationIdAndTrackCodeAndEntryType(qualification.getId(), track,
                    HrNightRewardLedgerEntryType.MONTH_REVERSAL).isEmpty();
            if (credited && !reversed) {
                BigDecimal value = track == HrNightRewardTrack.PERIODIC_NIGHT ? PERIODIC_MONTH_CREDIT : LOYALTY_MONTH_CREDIT;
                ledgerRepository.save(ledger(program, qualification, track, HrNightRewardLedgerEntryType.MONTH_REVERSAL,
                        value.negate(), "Đảo tích lũy vì dữ liệu chấm công được mở khóa: " + reason, actor));
            }
        }
    }

    private void persistSources(HrNightRewardMonthlyQualification qualification, List<HrProductionAttendanceShift> shifts,
                                HrImportActor actor) {
        List<HrNightRewardQualificationShift> sourceRows = new ArrayList<>();
        for (HrProductionAttendanceShift shift : shifts) {
            HrNightRewardQualificationShift source = new HrNightRewardQualificationShift();
            source.setQualificationId(qualification.getId());
            source.setAttendanceShiftId(shift.getId());
            source.setSourceImportId(shift.getImportId());
            source.setWorkDate(shift.getWorkDate());
            source.setShiftCode(Objects.toString(shift.getShiftCodeSnapshot(), ""));
            initialize(source, actor);
            sourceRows.add(source);
        }
        qualificationShiftRepository.saveAll(sourceRows);
    }

    private List<HrNightRewardMonthlyQualification> currentQualifications(List<HrNightRewardMonthlyQualification> values) {
        Map<String, HrNightRewardMonthlyQualification> latest = new LinkedHashMap<>();
        values.stream().sorted(Comparator.comparing(HrNightRewardMonthlyQualification::getAttendanceMonth)
                        .thenComparing(HrNightRewardMonthlyQualification::getRevision).reversed())
                .forEach(value -> latest.putIfAbsent(value.getAttendanceMonth(), value));
        return latest.values().stream().filter(value -> value.getStatus() != HrNightRewardMonthlyStatus.STALE)
                .sorted(Comparator.comparing(HrNightRewardMonthlyQualification::getAttendanceMonth)).toList();
    }

    private HrNightRewardDtos.ProgressResponse progress(HrNightRewardProgram program, String employeeId,
                                                         List<HrNightRewardMonthlyQualification> current) {
        int qualified = (int) current.stream().filter(value -> isQualified(value.getStatus())).count();
        int periodic = qualified % PERIODIC_CYCLE_MONTHS;
        int loyalty = qualified % LOYALTY_CYCLE_MONTHS;
        int draftPeriodic = (int) entitlementRepository.findByProgramIdAndEmployeeIdAndStatus(program.getId(), employeeId,
                HrNightRewardEntitlementStatus.DRAFT).stream().filter(value -> value.getTrackCode() == HrNightRewardTrack.PERIODIC_NIGHT).count();
        int draftLoyalty = (int) entitlementRepository.findByProgramIdAndEmployeeIdAndStatus(program.getId(), employeeId,
                HrNightRewardEntitlementStatus.DRAFT).stream().filter(value -> value.getTrackCode() == HrNightRewardTrack.LOYALTY_NIGHT).count();
        return new HrNightRewardDtos.ProgressResponse(periodic, PERIODIC_CYCLE_MONTHS, loyalty, LOYALTY_CYCLE_MONTHS,
                draftPeriodic, draftLoyalty);
    }

    private HrNightRewardMonthlyQualification latestQualification(String programId, String employeeId, String month) {
        return qualificationRepository.findFirstByProgramIdAndEmployeeIdAndAttendanceMonthOrderByRevisionDesc(programId, employeeId, month)
                .orElse(null);
    }

    private HrNightRewardDtos.ProgramResponse programResponse(HrNightRewardProgram value) {
        return new HrNightRewardDtos.ProgramResponse(value.getId(), value.getCode(), value.getName(), value.getEffectiveFrom(),
                value.getEffectiveTo(), value.getQualifyingNightThreshold(), value.getEligiblePolicyGroup(), value.isActive());
    }

    private HrNightRewardDtos.SourceShiftResponse sourceResponse(HrProductionAttendanceShift value) {
        return new HrNightRewardDtos.SourceShiftResponse(value.getId(), value.getImportId(), value.getWorkDate(),
                Objects.toString(value.getShiftCodeSnapshot(), ""), value.getStatus().name(), value.getResolutionType().name());
    }

    private HrNightRewardDtos.SourceShiftResponse sourceResponse(HrNightRewardQualificationShift value) {
        return new HrNightRewardDtos.SourceShiftResponse(value.getAttendanceShiftId(), value.getSourceImportId(), value.getWorkDate(),
                value.getShiftCode(), "SNAPSHOT", "SNAPSHOT");
    }

    private HrNightRewardDtos.QualificationResponse qualificationResponse(HrNightRewardMonthlyQualification value) {
        return new HrNightRewardDtos.QualificationResponse(value.getId(), value.getAttendanceMonth(), value.getRevision(), value.getStatus(),
                value.getActualNightShiftCount(), value.getRequiredNightShiftCount(), value.getQualificationReason(), value.getFinalizedAt(),
                value.getFinalizedByActor(), value.getStaleAt(), value.getStaleReason(), qualificationShiftRepository
                .findByQualificationIdOrderByWorkDateAsc(value.getId()).stream().map(this::sourceResponse).toList());
    }

    private HrNightRewardDtos.ExceptionResponse exceptionResponse(HrNightRewardException value) {
        return new HrNightRewardDtos.ExceptionResponse(value.getId(), value.getEmployeeCode(), value.getAttendanceMonth(),
                value.getExceptionType(), value.getStatus(), value.getReason(), value.getEvidenceReference(), value.getCreatedAt(),
                value.getReviewedAt(), value.getReviewedByActor(), value.getReviewReason(), value.getCancelledAt(),
                value.getCancelledByActor(), value.getCancellationReason(), value.getRowVersion());
    }

    private HrNightRewardDtos.EntitlementResponse entitlementResponse(HrNightRewardEntitlement value) {
        return new HrNightRewardDtos.EntitlementResponse(value.getId(), value.getTrackCode(), value.getQualifiedMonthsAtMaturity(),
                value.getAmount(), value.getStatus(), value.getCreatedAt());
    }

    private HrNightRewardProgram effectiveProgram(YearMonth month) {
        return programRepository.findEffective(month.atDay(1)).orElseThrow(() -> HrApiException.notFound(
                "NIGHT_REWARD_PROGRAM_NOT_FOUND", "Không có chương trình thưởng ca đêm hiệu lực cho tháng này."));
    }

    private HrEmployee employeeByCode(String employeeCode) {
        String code = employeeCode == null ? "" : employeeCode.trim().toUpperCase(Locale.ROOT);
        return employeeRepository.findByEmployeeCode(code).orElseThrow(() -> HrApiException.notFound(
                "HR_EMPLOYEE_NOT_FOUND", "Không tìm thấy mã nhân viên."));
    }

    private HrNightRewardException exception(String id) {
        return exceptionRepository.findById(id).orElseThrow(() -> HrApiException.notFound(
                "NIGHT_REWARD_EXCEPTION_NOT_FOUND", "Không tìm thấy ngoại lệ thưởng ca đêm."));
    }

    private YearMonth parseMonth(String value) {
        try { return YearMonth.parse(Objects.requireNonNull(value, "month").trim()); }
        catch (RuntimeException ex) { throw HrApiException.badRequest("NIGHT_REWARD_MONTH_INVALID", "Tháng phải có dạng yyyy-MM."); }
    }

    private boolean isQualified(HrNightRewardMonthlyStatus status) {
        return status == HrNightRewardMonthlyStatus.QUALIFIED || status == HrNightRewardMonthlyStatus.QUALIFIED_EXCEPTION;
    }

    private void requireAdmin(HrImportActor actor, String message) {
        if (!"ADMIN".equalsIgnoreCase(actor.role())) {
            throw new HrApiException(org.springframework.http.HttpStatus.FORBIDDEN, "NIGHT_REWARD_ADMIN_REQUIRED", message);
        }
    }

    private void initialize(HrAuditable value, HrImportActor actor) {
        value.setCreatedByActor(actor.subject());
        value.setUpdatedByActor(actor.subject());
    }

    private void touch(HrAuditable value, HrImportActor actor) {
        value.setUpdatedByActor(actor.subject());
    }

    private void audit(HrImportActor actor, String action, String type, String id, List<String> changedFields, Map<String, ?> metadata) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(type);
        event.setEntityId(id);
        event.setChangedFields(writeJson(changedFields));
        event.setSanitizedMetadata(writeJson(metadata));
        auditRepository.save(event);
    }

    private LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Không thể tạo snapshot thưởng ca đêm.", ex); }
    }

    private record Candidate(HrEmployee employee, List<HrProductionAttendanceShift> eligibleShifts,
                             HrNightRewardMonthlyStatus status, String reason, boolean hasApprovedException,
                             Map<String, Object> snapshot) { }
    private record MonthBuild(String month, HrNightRewardProgram program, List<Candidate> candidates,
                              HrNightRewardDtos.MonthResponse response) { }
}

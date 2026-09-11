package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrProductionAttendanceDtos;
import com.booking.system.hr.entity.*;
import com.booking.system.hr.enums.*;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrProductionAttendanceWorkbookParser;
import com.booking.system.hr.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HrProductionAttendanceService {
    private static final Set<BigDecimal> VALID_WORK_VALUES = Set.of(
            BigDecimal.ZERO, BigDecimal.ONE, new BigDecimal("1.5"), new BigDecimal("2"));

    private final HrProductionAttendanceWorkbookParser parser;
    private final HrProductionShiftMatcher matcher;
    private final HrAttendanceShiftPolicyRepository shiftPolicyRepository;
    private final HrAttendanceWorkCreditRuleRepository creditRuleRepository;
    private final HrEmployeeAttendancePolicyRepository employeePolicyRepository;
    private final HrProductionAttendanceImportRepository importRepository;
    private final HrAttendanceSourceDayRepository sourceDayRepository;
    private final HrAttendancePunchRepository punchRepository;
    private final HrProductionAttendanceShiftRepository shiftRepository;
    private final HrAttendanceShiftAdjustmentRepository adjustmentRepository;
    private final HrAttendanceIncidentRepository incidentRepository;
    private final HrAttendanceExemptionRepository exemptionRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrAuditEventRepository auditRepository;
    /** Spring Boot 4 in this project does not expose a Jackson 2 ObjectMapper bean. */
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<HrProductionAttendanceDtos.ShiftPolicyResponse> shiftPolicies() {
        return shiftPolicyRepository.findAllByOrderByPolicyGroupAscPriorityDescCodeAsc().stream()
                .map(this::toPolicyResponse).toList();
    }

    @Transactional
    public HrProductionAttendanceDtos.ShiftPolicyResponse updateShiftPolicy(
            String id, HrProductionAttendanceDtos.UpdateShiftPolicyRequest request, HrImportActor actor) {
        HrAttendanceShiftPolicy policy = policy(id);
        if (policy.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("ATTENDANCE_POLICY_VERSION_CONFLICT", "Cấu hình ca vừa được người khác cập nhật.");
        }
        validateDates(request.validFrom(), request.validTo());
        validateWindow(request.checkInFrom(), request.checkInUntil(), "cửa nhận lượt vào");
        validateWindow(request.checkOutFrom(), request.checkOutUntil(), "cửa nhận lượt ra");
        if (request.nightAllowanceAmount().signum() < 0) {
            throw HrApiException.badRequest("ATTENDANCE_ALLOWANCE_INVALID", "Phụ cấp ca đêm không được âm.");
        }
        policy.setName(request.name().trim());
        policy.setStandardStart(request.standardStart());
        policy.setStandardEnd(request.standardEnd());
        policy.setCheckInFrom(request.checkInFrom());
        policy.setCheckInUntil(request.checkInUntil());
        policy.setCheckOutFrom(request.checkOutFrom());
        policy.setCheckOutUntil(request.checkOutUntil());
        policy.setNightAllowanceAmount(request.nightAllowanceAmount());
        policy.setPriority(request.priority());
        policy.setActive(request.active());
        policy.setValidFrom(request.validFrom());
        policy.setValidTo(request.validTo());
        touch(policy, actor);
        shiftPolicyRepository.save(policy);
        audit(actor, "UPDATE_SHIFT_POLICY", "HR_ATTENDANCE_SHIFT_POLICY", id,
                List.of("schedule", "recognitionWindow", "allowance", "validity"), Map.of("code", policy.getCode()));
        return toPolicyResponse(policy);
    }

    @Transactional
    public HrProductionAttendanceDtos.EmployeePolicyResponse createEmployeePolicy(
            HrProductionAttendanceDtos.CreateEmployeePolicyRequest request, HrImportActor actor) {
        validateDates(request.validFrom(), request.validTo());
        HrEmployee employee = employee(request.employeeCode());
        if (!employeePolicyRepository.findOverlapping(employee.getId(), request.validFrom(), request.validTo()).isEmpty()) {
            throw HrApiException.conflict("ATTENDANCE_EMPLOYEE_POLICY_OVERLAP", "Nhân viên đã có chính sách chấm công chồng thời gian.");
        }
        HrEmployeeAttendancePolicy policy = new HrEmployeeAttendancePolicy();
        policy.setEmployeeId(employee.getId());
        policy.setPolicyGroup(request.policyGroup());
        policy.setValidFrom(request.validFrom());
        policy.setValidTo(request.validTo());
        policy.setSource("MANUAL");
        policy.setReason(request.reason().trim());
        initialize(policy, actor);
        employeePolicyRepository.save(policy);
        audit(actor, "CREATE_EMPLOYEE_POLICY", "HR_EMPLOYEE_ATTENDANCE_POLICY", policy.getId(),
                List.of("policyGroup", "validity"), Map.of("employeeCode", employee.getEmployeeCode()));
        return toEmployeePolicy(policy, employee.getEmployeeCode());
    }

    @Transactional(readOnly = true)
    public List<HrProductionAttendanceDtos.EmployeePolicyResponse> employeePolicies(String employeeCode) {
        HrEmployee employee = employee(employeeCode);
        return employeePolicyRepository.findByEmployeeIdOrderByValidFromDesc(employee.getId()).stream()
                .map(value -> toEmployeePolicy(value, employee.getEmployeeCode())).toList();
    }

    @Transactional
    public HrProductionAttendanceDtos.ExemptionResponse createExemption(
            HrProductionAttendanceDtos.CreateExemptionRequest request, HrImportActor actor) {
        validateDates(request.validFrom(), request.validTo());
        HrEmployee employee = employee(request.employeeCode());
        List<HrAttendanceExemption> overlaps = exemptionRepository.findEffective(
                List.of(employee.getEmployeeCode()), HrAttendanceExemptionStatus.CONFIRMED,
                request.validFrom(), request.validTo());
        if (!overlaps.isEmpty()) {
            throw HrApiException.conflict("ATTENDANCE_EXEMPTION_OVERLAP", "Đã có miễn chấm hiệu lực trong khoảng này.");
        }
        HrAttendanceExemption exemption = new HrAttendanceExemption();
        exemption.setEmployeeId(employee.getId());
        exemption.setEmployeeCode(employee.getEmployeeCode());
        exemption.setValidFrom(request.validFrom());
        exemption.setValidTo(request.validTo());
        exemption.setReason(request.reason().trim());
        exemption.setStatus(HrAttendanceExemptionStatus.CONFIRMED);
        exemption.setConfirmedAt(now());
        exemption.setConfirmedByActor(actor.subject());
        initialize(exemption, actor);
        exemptionRepository.save(exemption);
        audit(actor, "CREATE_ATTENDANCE_EXEMPTION", "HR_ATTENDANCE_EXEMPTION", exemption.getId(),
                List.of("validity", "status"), Map.of("employeeCode", employee.getEmployeeCode()));
        return toExemption(exemption);
    }

    @Transactional(readOnly = true)
    public List<HrProductionAttendanceDtos.ExemptionResponse> exemptions(String employeeCode) {
        return exemptionRepository.findByEmployeeCodeOrderByValidFromDesc(normalizeCode(employeeCode)).stream()
                .map(this::toExemption).toList();
    }

    @Transactional
    public HrProductionAttendanceDtos.ExemptionResponse cancelExemption(
            String id, HrProductionAttendanceDtos.CancelExemptionRequest request, HrImportActor actor) {
        HrAttendanceExemption exemption = exemptionRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_EXEMPTION_NOT_FOUND", "Không tìm thấy miễn chấm."));
        if (exemption.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("ATTENDANCE_EXEMPTION_VERSION_CONFLICT", "Miễn chấm vừa được người khác cập nhật.");
        }
        if (exemption.getStatus() != HrAttendanceExemptionStatus.CONFIRMED) {
            throw HrApiException.conflict("ATTENDANCE_EXEMPTION_ALREADY_CANCELLED", "Miễn chấm đã được hủy trước đó.");
        }
        exemption.setStatus(HrAttendanceExemptionStatus.CANCELLED);
        exemption.setCancelledAt(now());
        exemption.setCancelledByActor(actor.subject());
        exemption.setCancellationReason(request.reason().trim());
        touch(exemption, actor);
        exemptionRepository.save(exemption);
        audit(actor, "CANCEL_ATTENDANCE_EXEMPTION", "HR_ATTENDANCE_EXEMPTION", exemption.getId(),
                List.of("status", "cancellationReason"), Map.of("employeeCode", exemption.getEmployeeCode()));
        return toExemption(exemption);
    }

    @Transactional
    public HrProductionAttendanceDtos.ImportResponse upload(String fileName, byte[] bytes, String requestedMonth,
                                                             HrImportActor actor) {
        String checksum = sha256(bytes);
        Optional<HrProductionAttendanceImport> duplicate = importRepository.findByFileSha256(checksum);
        if (duplicate.isPresent()) return toImportResponse(duplicate.get());

        HrProductionAttendanceWorkbookParser.ParsedWorkbook workbook = parser.parse(bytes, requestedMonth);
        HrProductionAttendanceImport batch = new HrProductionAttendanceImport();
        batch.setSourceFileName(safeFileName(fileName));
        batch.setFileSha256(checksum);
        batch.setFileSize(bytes.length);
        batch.setSourceSheetName(workbook.sheetName());
        batch.setAttendanceMonth(workbook.attendanceMonth().toString());
        batch.setConfigurationJson(configurationSnapshot());
        batch.setStatus(HrAttendanceImportStatus.PREVIEWED);
        batch.setTotalRows(workbook.totalRows());
        batch.setTotalPunches(workbook.totalPunches());
        initialize(batch, actor);
        importRepository.save(batch);

        persistSource(workbook, batch, actor);
        List<String> importedCodes = workbook.days().stream().map(HrProductionAttendanceWorkbookParser.ParsedDay::employeeCode)
                .distinct().toList();
        recalculatePreviousMonthBoundary(workbook.attendanceMonth(), importedCodes, actor);
        calculate(batch, actor, false);
        audit(actor, "IMPORT_PRODUCTION_ATTENDANCE", "HR_PRODUCTION_ATTENDANCE_IMPORT", batch.getId(),
                List.of("sourceRows", "punches", "calculatedShifts"),
                Map.of("fileName", batch.getSourceFileName(), "month", batch.getAttendanceMonth()));
        return toImportResponse(batch);
    }

    private void recalculatePreviousMonthBoundary(YearMonth importedMonth, List<String> importedCodes,
                                                  HrImportActor actor) {
        String previousMonth = importedMonth.minusMonths(1).toString();
        for (HrProductionAttendanceImport previous : importRepository
                .findByAttendanceMonthAndStatusOrderByCreatedAtAsc(previousMonth, HrAttendanceImportStatus.PREVIEWED)) {
            if (!sourceDayRepository.existsByImportIdAndEmployeeCodeIn(previous.getId(), importedCodes)) continue;
            shiftRepository.deactivateByImportId(previous.getId());
            previous.setProcessingVersion(previous.getProcessingVersion() + 1);
            previous.setConfigurationJson(configurationSnapshot());
            touch(previous, actor);
            calculate(previous, actor, true);
            audit(actor, "RECALCULATE_PRODUCTION_ATTENDANCE_MONTH_BOUNDARY",
                    "HR_PRODUCTION_ATTENDANCE_IMPORT", previous.getId(),
                    List.of("processingVersion", "monthBoundary"),
                    Map.of("version", previous.getProcessingVersion(), "nextMonth", importedMonth.toString()));
        }
    }

    @Transactional
    public HrProductionAttendanceDtos.ImportResponse recalculate(String importId, HrImportActor actor) {
        HrProductionAttendanceImport batch = editableImport(importId);
        shiftRepository.deactivateByImportId(importId);
        batch.setProcessingVersion(batch.getProcessingVersion() + 1);
        batch.setConfigurationJson(configurationSnapshot());
        touch(batch, actor);
        calculate(batch, actor, true);
        audit(actor, "RECALCULATE_PRODUCTION_ATTENDANCE", "HR_PRODUCTION_ATTENDANCE_IMPORT", batch.getId(),
                List.of("processingVersion", "calculatedShifts"), Map.of("version", batch.getProcessingVersion()));
        return toImportResponse(batch);
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrProductionAttendanceDtos.ImportResponse> imports(int page, int size, String month) {
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        Page<HrProductionAttendanceImport> result = month == null || month.isBlank()
                ? importRepository.findAllByOrderByCreatedAtDesc(pageable)
                : importRepository.findByAttendanceMonthOrderByCreatedAtDesc(month.trim(), pageable);
        return HrPageResponse.from(result, this::toImportResponse);
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrProductionAttendanceDtos.PunchResponse> punches(String importId, int page, int size) {
        importBatch(importId);
        return HrPageResponse.from(punchRepository.findByImportIdOrderByEmployeeCodeAscPunchedAtAsc(
                importId, PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200))), this::toPunchResponse);
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrProductionAttendanceDtos.ShiftResponse> shifts(
            String importId, HrProductionAttendanceShiftStatus status, int page, int size) {
        importBatch(importId);
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200));
        Page<HrProductionAttendanceShift> result = status == null
                ? shiftRepository.findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(importId, pageable)
                : shiftRepository.findByImportIdAndActiveTrueAndStatusOrderByEmployeeCodeAscWorkDateAsc(importId, status, pageable);
        return HrPageResponse.from(result, this::toShiftResponse);
    }

    @Transactional
    public HrProductionAttendanceDtos.ShiftResponse decideShift(
            String id, HrProductionAttendanceDtos.ShiftDecisionRequest request, HrImportActor actor) {
        HrProductionAttendanceShift shift = activeShift(id);
        editableImport(shift.getImportId());
        if (shift.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("ATTENDANCE_SHIFT_VERSION_CONFLICT", "Ca vừa được người khác cập nhật.");
        }
        String before = shiftSnapshot(shift);
        if (request.action() == HrProductionAttendanceDtos.DecisionAction.REJECT) {
            shift.setStatus(HrProductionAttendanceShiftStatus.REJECTED);
            shift.setWorkValue(BigDecimal.ZERO);
            shift.setNightAllowanceAmount(BigDecimal.ZERO);
        } else {
            validateWorkValue(request.workValue());
            if (request.nightAllowanceAmount().signum() < 0) {
                throw HrApiException.badRequest("ATTENDANCE_ALLOWANCE_INVALID", "Phụ cấp không được âm.");
            }
            applyPolicyAndPunchSelection(shift, request);
            shift.setWorkValue(request.workValue());
            shift.setNightAllowanceAmount(request.nightAllowanceAmount());
            shift.setStatus(HrProductionAttendanceShiftStatus.CONFIRMED);
        }
        shift.setResolutionType(HrAttendanceResolutionType.MANUAL_OVERRIDE);
        shift.setExplanation(request.reason().trim());
        shift.setConfirmedAt(now());
        shift.setConfirmedByActor(actor.subject());
        touch(shift, actor);
        shiftRepository.save(shift);
        adjustment(shift, before, request.reason(), actor);
        refreshCounts(importBatch(shift.getImportId()), actor);
        audit(actor, "DECIDE_PRODUCTION_ATTENDANCE_SHIFT", "HR_ATTENDANCE_SHIFT", shift.getId(),
                List.of("status", "policy", "punches", "workValue", "allowance"), Map.of("action", request.action().name()));
        return toShiftResponse(shift);
    }

    @Transactional(readOnly = true)
    public List<HrProductionAttendanceDtos.ShiftAdjustmentResponse> shiftAdjustments(String shiftId) {
        shiftRepository.findById(shiftId)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_SHIFT_NOT_FOUND", "Không tìm thấy ca chấm công."));
        return adjustmentRepository.findByShiftIdOrderByCreatedAtDesc(shiftId).stream()
                .map(value -> new HrProductionAttendanceDtos.ShiftAdjustmentResponse(
                        value.getId(), value.getShiftId(), value.getBeforeJson(), value.getAfterJson(),
                        value.getReason(), value.getCreatedAt(), value.getCreatedByActor()))
                .toList();
    }

    @Transactional
    public List<HrProductionAttendanceDtos.ShiftResponse> bulkConfirm(
            HrProductionAttendanceDtos.BulkConfirmRequest request, HrImportActor actor) {
        List<HrProductionAttendanceShift> shifts = shiftRepository.findAllByIdIn(request.shiftIds());
        if (shifts.size() != new HashSet<>(request.shiftIds()).size()) {
            throw HrApiException.notFound("ATTENDANCE_SHIFT_NOT_FOUND", "Có ca không còn tồn tại.");
        }
        for (HrProductionAttendanceShift shift : shifts) {
            editableImport(shift.getImportId());
            if (!shift.isActive() || shift.getStatus() != HrProductionAttendanceShiftStatus.AUTO_MATCHED) {
                throw HrApiException.conflict("ATTENDANCE_SHIFT_NOT_AUTO_MATCHED", "Chỉ xác nhận hàng loạt ca tự ghép hợp lệ.");
            }
            String before = shiftSnapshot(shift);
            shift.setStatus(HrProductionAttendanceShiftStatus.CONFIRMED);
            shift.setConfirmedAt(now());
            shift.setConfirmedByActor(actor.subject());
            touch(shift, actor);
            adjustment(shift, before, request.reason(), actor);
        }
        shiftRepository.saveAll(shifts);
        shifts.stream().map(HrProductionAttendanceShift::getImportId).distinct()
                .forEach(importId -> refreshCounts(importBatch(importId), actor));
        return shifts.stream().map(this::toShiftResponse).toList();
    }

    @Transactional
    public HrProductionAttendanceDtos.ImportResponse confirmImport(String importId, HrImportActor actor) {
        HrProductionAttendanceImport batch = editableImport(importId);
        if (shiftRepository.countByImportIdAndActiveTrueAndStatus(importId, HrProductionAttendanceShiftStatus.NEEDS_REVIEW) > 0) {
            throw HrApiException.conflict("ATTENDANCE_IMPORT_REVIEW_REQUIRED", "Còn ca cần kiểm tra trước khi chốt kỳ.");
        }
        List<HrProductionAttendanceShift> shifts = shiftRepository.findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(importId);
        for (HrProductionAttendanceShift shift : shifts) {
            if (shift.getStatus() == HrProductionAttendanceShiftStatus.AUTO_MATCHED) {
                shift.setStatus(HrProductionAttendanceShiftStatus.CONFIRMED);
                shift.setConfirmedAt(now());
                shift.setConfirmedByActor(actor.subject());
                touch(shift, actor);
            }
        }
        shiftRepository.saveAll(shifts);
        batch.setStatus(HrAttendanceImportStatus.CONFIRMED);
        batch.setConfirmedAt(now());
        batch.setConfirmedByActor(actor.subject());
        touch(batch, actor);
        importRepository.save(batch);
        audit(actor, "CONFIRM_PRODUCTION_ATTENDANCE_IMPORT", "HR_PRODUCTION_ATTENDANCE_IMPORT", importId,
                List.of("status", "confirmedAt"), Map.of("month", batch.getAttendanceMonth()));
        return toImportResponse(batch);
    }

    @Transactional
    public HrProductionAttendanceDtos.IncidentResponse createIncident(
            HrProductionAttendanceDtos.CreateIncidentRequest request, HrImportActor actor) {
        if (!request.endedAt().isAfter(request.startedAt())) {
            throw HrApiException.badRequest("ATTENDANCE_INCIDENT_PERIOD_INVALID", "Thời gian kết thúc phải sau thời gian bắt đầu.");
        }
        List<String> scope = normalizeScope(request.scopeValues());
        if (request.scopeType() != HrAttendanceIncidentScopeType.ALL && scope.isEmpty()) {
            throw HrApiException.badRequest("ATTENDANCE_INCIDENT_SCOPE_EMPTY", "Phạm vi sự cố không được trống.");
        }
        HrAttendanceIncident incident = new HrAttendanceIncident();
        incident.setStartedAt(request.startedAt());
        incident.setEndedAt(request.endedAt());
        incident.setScopeType(request.scopeType());
        incident.setScopeValuesJson(writeJson(scope));
        incident.setDescription(request.description().trim());
        incident.setStatus(HrAttendanceIncidentStatus.DRAFT);
        initialize(incident, actor);
        incidentRepository.save(incident);
        audit(actor, "CREATE_ATTENDANCE_INCIDENT", "HR_ATTENDANCE_INCIDENT", incident.getId(),
                List.of("period", "scope", "status"), Map.of("type", "DEVICE_OUTAGE"));
        return toIncidentResponse(incident);
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrProductionAttendanceDtos.IncidentResponse> incidents(int page, int size) {
        return HrPageResponse.from(incidentRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100))), this::toIncidentResponse);
    }

    @Transactional(readOnly = true)
    public List<HrProductionAttendanceDtos.IncidentCandidate> analyzeIncident(String incidentId, String importId) {
        HrAttendanceIncident incident = draftIncident(incidentId);
        List<HrProductionAttendanceShift> shifts = shiftRepository.findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(importId);
        Map<String, HrEmployee> employees = employees(shifts.stream().map(HrProductionAttendanceShift::getEmployeeCode).toList());
        List<HrProductionAttendanceDtos.IncidentCandidate> result = new ArrayList<>();
        for (HrProductionAttendanceShift shift : shifts) {
            if (shift.getStatus() != HrProductionAttendanceShiftStatus.NEEDS_REVIEW || !inScope(incident, shift, employees.get(shift.getEmployeeCode()))) continue;
            LocalDateTime missingAt = expectedMissingAt(shift);
            if (missingAt == null || missingAt.isBefore(incident.getStartedAt()) || missingAt.isAfter(incident.getEndedAt())) continue;
            result.add(new HrProductionAttendanceDtos.IncidentCandidate(shift.getId(), shift.getEmployeeCode(), shift.getWorkDate(),
                    shift.getShiftCodeSnapshot(), shift.getCheckInAt(), shift.getCheckOutAt(), missingAt,
                    shift.getWorkValue(), shift.getNightAllowanceAmount(), shift.getExplanation()));
        }
        return List.copyOf(result);
    }

    @Transactional
    public HrProductionAttendanceDtos.IncidentResponse confirmIncident(
            String incidentId, String importId, HrProductionAttendanceDtos.ConfirmIncidentRequest request,
            HrImportActor actor) {
        HrAttendanceIncident incident = draftIncident(incidentId);
        if (request.selections().stream().map(HrProductionAttendanceDtos.IncidentSelection::shiftId).distinct().count()
                != request.selections().size()) {
            throw HrApiException.badRequest("ATTENDANCE_INCIDENT_SELECTION_DUPLICATE", "Một ca chỉ được chọn một lần trong sự cố.");
        }
        Map<String, HrProductionAttendanceDtos.IncidentCandidate> candidates = analyzeIncident(incidentId, importId).stream()
                .collect(Collectors.toMap(HrProductionAttendanceDtos.IncidentCandidate::shiftId, Function.identity()));
        for (HrProductionAttendanceDtos.IncidentSelection selection : request.selections()) {
            if (!candidates.containsKey(selection.shiftId())) {
                throw HrApiException.conflict("ATTENDANCE_INCIDENT_SHIFT_NOT_AFFECTED", "Ca đã chọn không nằm trong danh sách ảnh hưởng.");
            }
            validateWorkValue(selection.workValue());
            if (selection.workValue().signum() <= 0 || selection.nightAllowanceAmount().signum() < 0) {
                throw HrApiException.badRequest("ATTENDANCE_INCIDENT_VALUE_INVALID", "Ca sự cố phải có công dương và phụ cấp không âm.");
            }
            HrProductionAttendanceShift shift = activeShift(selection.shiftId());
            String before = shiftSnapshot(shift);
            shift.setWorkValue(selection.workValue());
            shift.setNightAllowanceAmount(selection.nightAllowanceAmount());
            shift.setStatus(HrProductionAttendanceShiftStatus.CONFIRMED);
            shift.setResolutionType(HrAttendanceResolutionType.DEVICE_OUTAGE);
            shift.setIncidentId(incidentId);
            shift.setExplanation(request.reason().trim());
            shift.setConfirmedAt(now());
            shift.setConfirmedByActor(actor.subject());
            touch(shift, actor);
            ensurePunchesNotReused(shift);
            shiftRepository.save(shift);
            adjustment(shift, before, request.reason(), actor);
        }
        incident.setStatus(HrAttendanceIncidentStatus.CONFIRMED);
        incident.setConfirmedAt(now());
        incident.setConfirmedByActor(actor.subject());
        touch(incident, actor);
        incidentRepository.save(incident);
        refreshCounts(importBatch(importId), actor);
        audit(actor, "CONFIRM_ATTENDANCE_INCIDENT", "HR_ATTENDANCE_INCIDENT", incidentId,
                List.of("status", "affectedShifts"), Map.of("shiftCount", request.selections().size()));
        return toIncidentResponse(incident);
    }

    @Transactional
    public HrProductionAttendanceDtos.IncidentResponse cancelIncident(String incidentId, HrImportActor actor) {
        HrAttendanceIncident incident = draftIncident(incidentId);
        incident.setStatus(HrAttendanceIncidentStatus.CANCELLED);
        incident.setCancelledAt(now());
        incident.setCancelledByActor(actor.subject());
        touch(incident, actor);
        incidentRepository.save(incident);
        audit(actor, "CANCEL_ATTENDANCE_INCIDENT", "HR_ATTENDANCE_INCIDENT", incidentId,
                List.of("status"), Map.of("type", "DEVICE_OUTAGE"));
        return toIncidentResponse(incident);
    }

    private void persistSource(HrProductionAttendanceWorkbookParser.ParsedWorkbook workbook,
                               HrProductionAttendanceImport batch, HrImportActor actor) {
        Map<String, HrEmployee> employees = employees(workbook.days().stream().map(HrProductionAttendanceWorkbookParser.ParsedDay::employeeCode).toList());
        List<HrAttendancePunch> punches = new ArrayList<>();
        for (HrProductionAttendanceWorkbookParser.ParsedDay parsed : workbook.days()) {
            HrEmployee employee = employees.get(parsed.employeeCode());
            HrAttendanceSourceDay day = new HrAttendanceSourceDay();
            day.setImportId(batch.getId());
            day.setEmployeeId(employee == null ? null : employee.getId());
            day.setEmployeeCode(parsed.employeeCode());
            day.setEmployeeName(parsed.employeeName());
            day.setWorkDate(parsed.workDate());
            day.setSourceRowNumber(parsed.sourceRowNumber());
            initialize(day, actor);
            sourceDayRepository.save(day);
            for (HrProductionAttendanceWorkbookParser.ParsedPunch parsedPunch : parsed.punches()) {
                HrAttendancePunch punch = new HrAttendancePunch();
                punch.setImportId(batch.getId());
                punch.setSourceDayId(day.getId());
                punch.setEmployeeId(day.getEmployeeId());
                punch.setEmployeeCode(day.getEmployeeCode());
                punch.setEmployeeName(day.getEmployeeName());
                punch.setWorkDate(day.getWorkDate());
                punch.setPunchedAt(parsedPunch.punchedAt());
                punch.setSourceRowNumber(day.getSourceRowNumber());
                punch.setSourceColumn(parsedPunch.sourceColumn());
                punch.setRawValue(parsedPunch.rawValue());
                initialize(punch, actor);
                punches.add(punch);
            }
        }
        punchRepository.saveAll(punches);
    }

    private void calculate(HrProductionAttendanceImport batch, HrImportActor actor, boolean recalculation) {
        List<HrAttendanceSourceDay> sourceDays = sourceDayRepository.findByImportIdOrderByEmployeeCodeAscWorkDateAsc(batch.getId());
        List<HrAttendancePunch> punches = punchRepository.findByImportIdOrderByEmployeeCodeAscPunchedAtAsc(batch.getId());
        Map<String, HrEmployee> employees = employees(sourceDays.stream().map(HrAttendanceSourceDay::getEmployeeCode).toList());
        Map<String, List<HrAttendancePunch>> punchesByCode = punches.stream().collect(Collectors.groupingBy(HrAttendancePunch::getEmployeeCode));
        YearMonth attendanceMonth = YearMonth.parse(batch.getAttendanceMonth());
        LocalDate boundaryDate = attendanceMonth.atEndOfMonth().plusDays(1);
        List<String> importCodes = sourceDays.stream().map(HrAttendanceSourceDay::getEmployeeCode).distinct().toList();
        Map<String, List<HrAttendancePunch>> boundaryPunchesByCode = importCodes.isEmpty() ? Map.of()
                : punchRepository.findBoundaryPunches(batch.getId(), importCodes, boundaryDate.atStartOfDay(),
                        boundaryDate.plusDays(1).atStartOfDay()).stream()
                .collect(Collectors.groupingBy(HrAttendancePunch::getEmployeeCode));
        List<String> candidatePunchIds = java.util.stream.Stream.concat(
                        punches.stream(), boundaryPunchesByCode.values().stream().flatMap(Collection::stream))
                .map(HrAttendancePunch::getId).distinct().toList();
        Set<String> reservedByOtherImports = candidatePunchIds.isEmpty() ? Set.of()
                : shiftRepository.findOtherActiveCompleteShiftsUsingPunches(batch.getId(), candidatePunchIds).stream()
                .flatMap(value -> java.util.stream.Stream.of(value.getCheckInPunchId(), value.getCheckOutPunchId()))
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, List<HrAttendanceExemption>> exemptions = effectiveExemptions(sourceDays);
        List<HrAttendanceShiftPolicy> allPolicies = shiftPolicyRepository.findAllByOrderByPolicyGroupAscPriorityDescCodeAsc();
        List<HrAttendanceWorkCreditRule> allRules = creditRuleRepository.findAllByOrderByPriorityDesc();
        List<HrProductionAttendanceShift> calculated = new ArrayList<>();

        Map<String, List<HrAttendanceSourceDay>> daysByCode = sourceDays.stream()
                .collect(Collectors.groupingBy(HrAttendanceSourceDay::getEmployeeCode, LinkedHashMap::new, Collectors.toList()));
        for (Map.Entry<String, List<HrAttendanceSourceDay>> entry : daysByCode.entrySet()) {
            String code = entry.getKey();
            HrEmployee employee = employees.get(code);
            Map<HrAttendancePolicyGroup, List<HrAttendanceSourceDay>> groupedDays = entry.getValue().stream()
                    .collect(Collectors.groupingBy(day -> policyGroup(employee, day.getWorkDate()), LinkedHashMap::new, Collectors.toList()));
            for (Map.Entry<HrAttendancePolicyGroup, List<HrAttendanceSourceDay>> groupEntry : groupedDays.entrySet()) {
                HrAttendancePolicyGroup group = groupEntry.getKey();
                List<HrProductionShiftMatcher.WorkDay> matcherDays = groupEntry.getValue().stream().map(day -> {
                    List<HrProductionShiftMatcher.Punch> dayPunches = punchesByCode.getOrDefault(code, List.of()).stream()
                            .filter(punch -> punch.getWorkDate().equals(day.getWorkDate()))
                            .filter(punch -> !reservedByOtherImports.contains(punch.getId()))
                            .map(punch -> new HrProductionShiftMatcher.Punch(punch.getId(), punch.getPunchedAt())).toList();
                    boolean excluded = exemptions.getOrDefault(code, List.of()).stream()
                            .anyMatch(value -> between(day.getWorkDate(), value.getValidFrom(), value.getValidTo()));
                    return new HrProductionShiftMatcher.WorkDay(day.getSourceRowNumber(), day.getWorkDate(), dayPunches, excluded);
                }).toList();
                List<HrProductionShiftMatcher.ShiftPolicy> policies = allPolicies.stream()
                        .filter(value -> value.isActive() && value.getPolicyGroup() == group).map(this::matcherPolicy).toList();
                Set<String> policyIds = policies.stream().map(HrProductionShiftMatcher.ShiftPolicy::id).collect(Collectors.toSet());
                List<HrProductionShiftMatcher.CreditRule> rules = allRules.stream()
                        .filter(value -> value.isActive() && policyIds.contains(value.getShiftPolicyId())).map(this::matcherRule).toList();
                Map<Integer, HrAttendanceSourceDay> byRow = groupEntry.getValue().stream()
                        .collect(Collectors.toMap(HrAttendanceSourceDay::getSourceRowNumber, Function.identity()));
                List<HrProductionShiftMatcher.Punch> supplemental = boundaryPunchesByCode.getOrDefault(code, List.of()).stream()
                        .filter(value -> !reservedByOtherImports.contains(value.getId()))
                        .map(value -> new HrProductionShiftMatcher.Punch(value.getId(), value.getPunchedAt())).toList();
                for (HrProductionShiftMatcher.MatchResult match : matcher.match(matcherDays, supplemental, policies, rules)) {
                    HrAttendanceSourceDay source = byRow.get(match.sourceRowNumber());
                    HrProductionAttendanceShift shift = new HrProductionAttendanceShift();
                    shift.setImportId(batch.getId());
                    shift.setEmployeeId(source.getEmployeeId());
                    shift.setEmployeeCode(source.getEmployeeCode());
                    shift.setEmployeeName(source.getEmployeeName());
                    shift.setWorkDate(match.workDate());
                    shift.setCalculationVersion(batch.getProcessingVersion());
                    shift.setActive(true);
                    shift.setPolicyGroup(group);
                    shift.setShiftPolicyId(match.shiftPolicyId());
                    shift.setShiftCodeSnapshot(match.shiftCode());
                    shift.setWorkCreditRuleId(match.creditRuleId());
                    shift.setCheckInPunchId(match.checkInPunchId());
                    shift.setCheckOutPunchId(match.checkOutPunchId());
                    shift.setCheckInAt(match.checkInAt());
                    shift.setCheckOutAt(match.checkOutAt());
                    shift.setWorkValue(match.workValue());
                    shift.setNightAllowanceAmount(match.nightAllowanceAmount());
                    shift.setStatus(employee == null && match.status() == HrProductionAttendanceShiftStatus.AUTO_MATCHED
                            ? HrProductionAttendanceShiftStatus.NEEDS_REVIEW : match.status());
                    shift.setResolutionType(match.resolutionType());
                    shift.setExplanation(employee == null
                            ? "Không tìm thấy mã nhân viên trong hồ sơ; " + match.explanation() : match.explanation());
                    initialize(shift, actor);
                    calculated.add(shift);
                }
            }
        }
        shiftRepository.saveAll(calculated);
        refreshCounts(batch, actor);
    }

    private Map<String, List<HrAttendanceExemption>> effectiveExemptions(List<HrAttendanceSourceDay> days) {
        if (days.isEmpty()) return Map.of();
        List<String> codes = days.stream().map(HrAttendanceSourceDay::getEmployeeCode).distinct().toList();
        LocalDate from = days.stream().map(HrAttendanceSourceDay::getWorkDate).min(LocalDate::compareTo).orElseThrow();
        LocalDate to = days.stream().map(HrAttendanceSourceDay::getWorkDate).max(LocalDate::compareTo).orElseThrow();
        return exemptionRepository.findEffective(codes, HrAttendanceExemptionStatus.CONFIRMED, from, to).stream()
                .collect(Collectors.groupingBy(HrAttendanceExemption::getEmployeeCode));
    }

    private HrAttendancePolicyGroup policyGroup(HrEmployee employee, LocalDate date) {
        if (employee != null) {
            List<HrEmployeeAttendancePolicy> explicit = employeePolicyRepository.findEffective(employee.getId(), date);
            if (!explicit.isEmpty()) return explicit.get(0).getPolicyGroup();
            if (employee.getEmployment() != null && employee.getEmployment().getDepartment() != null) {
                String department = (employee.getEmployment().getDepartment().getCode() + " "
                        + employee.getEmployment().getDepartment().getName()).toUpperCase(Locale.ROOT);
                if (department.contains("KCS")) return HrAttendancePolicyGroup.KCS;
            }
            if (employee.getWorkforceGroup() == HrWorkforceGroup.GENERAL_LABOR) {
                return HrAttendancePolicyGroup.PRODUCTION_WORKER;
            }
        }
        return HrAttendancePolicyGroup.PRODUCTION_WORKER;
    }

    private void applyPolicyAndPunchSelection(HrProductionAttendanceShift shift,
                                              HrProductionAttendanceDtos.ShiftDecisionRequest request) {
        if (request.shiftCode() != null && !request.shiftCode().isBlank()) {
            HrAttendanceShiftPolicy policy = shiftPolicyRepository.findByCode(request.shiftCode().trim())
                    .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_SHIFT_POLICY_NOT_FOUND", "Không tìm thấy mã ca."));
            if (policy.getPolicyGroup() != shift.getPolicyGroup()) {
                throw HrApiException.badRequest("ATTENDANCE_SHIFT_POLICY_GROUP_MISMATCH", "Ca không thuộc nhóm chính sách của nhân viên.");
            }
            shift.setShiftPolicyId(policy.getId());
            shift.setShiftCodeSnapshot(policy.getCode());
        }
        HrAttendanceShiftPolicy appliedPolicy = shift.getShiftPolicyId() == null ? null : policy(shift.getShiftPolicyId());
        HrAttendancePunch checkIn = selectedPunch(request.checkInPunchId(), shift, appliedPolicy, true, "lượt vào");
        HrAttendancePunch checkOut = selectedPunch(request.checkOutPunchId(), shift, appliedPolicy, false, "lượt ra");
        if (checkIn != null) {
            shift.setCheckInPunchId(checkIn.getId());
            shift.setCheckInAt(checkIn.getPunchedAt());
        }
        if (checkOut != null) {
            shift.setCheckOutPunchId(checkOut.getId());
            shift.setCheckOutAt(checkOut.getPunchedAt());
        }
        if (shift.getCheckInAt() != null && shift.getCheckOutAt() != null
                && !shift.getCheckOutAt().isAfter(shift.getCheckInAt())) {
            throw HrApiException.badRequest("ATTENDANCE_PUNCH_ORDER_INVALID", "Lượt ra phải sau lượt vào.");
        }
        ensurePunchesNotReused(shift);
    }

    private HrAttendancePunch selectedPunch(String id, HrProductionAttendanceShift shift,
                                             HrAttendanceShiftPolicy policy, boolean checkIn, String label) {
        if (id == null || id.isBlank()) return null;
        if (policy == null) {
            throw HrApiException.badRequest("ATTENDANCE_SHIFT_POLICY_REQUIRED", "Phải chọn ca trước khi chọn dấu chấm.");
        }
        HrAttendancePunch punch = punchRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_PUNCH_NOT_FOUND", "Không tìm thấy " + label + "."));
        if (!punch.getEmployeeCode().equals(shift.getEmployeeCode())) {
            throw HrApiException.badRequest("ATTENDANCE_PUNCH_SCOPE_INVALID", "Dấu chấm không thuộc cùng nhân viên.");
        }
        LocalDate expectedDate = checkIn || !policy.isCrossesMidnight()
                ? shift.getWorkDate() : shift.getWorkDate().plusDays(1);
        LocalTime from = checkIn ? policy.getCheckInFrom() : policy.getCheckOutFrom();
        LocalTime until = checkIn ? policy.getCheckInUntil() : policy.getCheckOutUntil();
        if (!punch.getPunchedAt().toLocalDate().equals(expectedDate)
                || !withinWindow(punch.getPunchedAt().toLocalTime(), from, until)) {
            throw HrApiException.badRequest("ATTENDANCE_PUNCH_WINDOW_INVALID",
                    "Dấu chấm không thuộc ngày/cửa thời gian của " + label + " đã chọn.");
        }
        if (!punch.getImportId().equals(shift.getImportId())
                && (checkIn || !policy.isCrossesMidnight()
                || YearMonth.from(expectedDate).equals(YearMonth.from(shift.getWorkDate())))) {
            throw HrApiException.badRequest("ATTENDANCE_PUNCH_SCOPE_INVALID",
                    "Chỉ lượt ra ca đêm đầu tháng kế tiếp mới được lấy từ import khác.");
        }
        return punch;
    }

    private void ensurePunchesNotReused(HrProductionAttendanceShift selected) {
        for (HrProductionAttendanceShift other : shiftRepository.findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(selected.getImportId())) {
            if (other.getId().equals(selected.getId())) continue;
            Set<String> otherIds = new HashSet<>(Arrays.asList(other.getCheckInPunchId(), other.getCheckOutPunchId()));
            otherIds.remove(null);
            if (otherIds.contains(selected.getCheckInPunchId()) || otherIds.contains(selected.getCheckOutPunchId())) {
                throw HrApiException.conflict("ATTENDANCE_PUNCH_ALREADY_USED", "Một dấu chấm đang được dùng cho ca khác.");
            }
        }
        List<String> selectedIds = java.util.stream.Stream.of(selected.getCheckInPunchId(), selected.getCheckOutPunchId())
                .filter(Objects::nonNull).distinct().toList();
        if (!selectedIds.isEmpty()
                && !shiftRepository.findOtherActiveCompleteShiftsUsingPunches(selected.getImportId(), selectedIds).isEmpty()) {
            throw HrApiException.conflict("ATTENDANCE_PUNCH_ALREADY_USED",
                    "Một dấu chấm đang được dùng cho ca thuộc import khác.");
        }
    }

    private boolean withinWindow(LocalTime value, LocalTime from, LocalTime until) {
        if (!from.isAfter(until)) return !value.isBefore(from) && !value.isAfter(until);
        return !value.isBefore(from) || !value.isAfter(until);
    }

    private LocalDateTime expectedMissingAt(HrProductionAttendanceShift shift) {
        if ((shift.getCheckInAt() == null) == (shift.getCheckOutAt() == null) || shift.getShiftPolicyId() == null) return null;
        HrAttendanceShiftPolicy policy = policy(shift.getShiftPolicyId());
        if (shift.getCheckInAt() == null) return LocalDateTime.of(shift.getWorkDate(), policy.getStandardStart());
        LocalDate endDate = policy.isCrossesMidnight() ? shift.getWorkDate().plusDays(1) : shift.getWorkDate();
        return LocalDateTime.of(endDate, policy.getStandardEnd());
    }

    private boolean inScope(HrAttendanceIncident incident, HrProductionAttendanceShift shift, HrEmployee employee) {
        if (incident.getScopeType() == HrAttendanceIncidentScopeType.ALL) return true;
        Set<String> scope = readList(incident.getScopeValuesJson()).stream().map(value -> value.toUpperCase(Locale.ROOT)).collect(Collectors.toSet());
        if (incident.getScopeType() == HrAttendanceIncidentScopeType.EMPLOYEE_CODES) return scope.contains(shift.getEmployeeCode().toUpperCase(Locale.ROOT));
        if (incident.getScopeType() == HrAttendanceIncidentScopeType.POLICY_GROUP) return scope.contains(shift.getPolicyGroup().name());
        if (employee == null || employee.getEmployment() == null || employee.getEmployment().getDepartment() == null) return false;
        HrDepartment department = employee.getEmployment().getDepartment();
        return scope.contains(department.getId().toUpperCase(Locale.ROOT))
                || scope.contains(department.getCode().toUpperCase(Locale.ROOT))
                || scope.contains(department.getName().toUpperCase(Locale.ROOT));
    }

    private void adjustment(HrProductionAttendanceShift shift, String before, String reason, HrImportActor actor) {
        HrAttendanceShiftAdjustment adjustment = new HrAttendanceShiftAdjustment();
        adjustment.setShiftId(shift.getId());
        adjustment.setBeforeJson(before);
        adjustment.setAfterJson(shiftSnapshot(shift));
        adjustment.setReason(reason.trim());
        initialize(adjustment, actor);
        adjustmentRepository.save(adjustment);
    }

    private void refreshCounts(HrProductionAttendanceImport batch, HrImportActor actor) {
        String id = batch.getId();
        batch.setAutoMatchedShifts((int) shiftRepository.countByImportIdAndActiveTrueAndStatus(id, HrProductionAttendanceShiftStatus.AUTO_MATCHED));
        batch.setReviewShifts((int) shiftRepository.countByImportIdAndActiveTrueAndStatus(id, HrProductionAttendanceShiftStatus.NEEDS_REVIEW));
        batch.setNoPunchRows((int) shiftRepository.countByImportIdAndActiveTrueAndStatus(id, HrProductionAttendanceShiftStatus.NO_PUNCH));
        batch.setExcludedRows((int) shiftRepository.countByImportIdAndActiveTrueAndStatus(id, HrProductionAttendanceShiftStatus.EXCLUDED));
        touch(batch, actor);
        importRepository.save(batch);
    }

    private String configurationSnapshot() {
        List<Map<String, Object>> policies = shiftPolicyRepository.findAllByOrderByPolicyGroupAscPriorityDescCodeAsc().stream()
                .map(value -> Map.<String, Object>of("id", value.getId(), "code", value.getCode(), "group", value.getPolicyGroup().name(),
                        "rowVersion", value.getRowVersion())).toList();
        List<Map<String, Object>> rules = creditRuleRepository.findAllByOrderByPriorityDesc().stream()
                .map(value -> Map.<String, Object>of("id", value.getId(), "policyId", value.getShiftPolicyId(),
                        "workValue", value.getWorkValue(), "rowVersion", value.getRowVersion())).toList();
        return writeJson(Map.of("engine", "production-attendance-v1", "policies", policies, "creditRules", rules));
    }

    private HrProductionShiftMatcher.ShiftPolicy matcherPolicy(HrAttendanceShiftPolicy value) {
        return new HrProductionShiftMatcher.ShiftPolicy(value.getId(), value.getCode(), value.getPolicyGroup(),
                value.getStandardStart(), value.getStandardEnd(), value.getCheckInFrom(), value.getCheckInUntil(),
                value.getCheckOutFrom(), value.getCheckOutUntil(), value.isCrossesMidnight(),
                value.getNightAllowanceAmount(), value.getPriority(), value.getValidFrom(), value.getValidTo());
    }

    private HrProductionShiftMatcher.CreditRule matcherRule(HrAttendanceWorkCreditRule value) {
        return new HrProductionShiftMatcher.CreditRule(value.getId(), value.getShiftPolicyId(), value.getCheckOutFrom(),
                value.getCheckOutUntil(), value.getWorkValue(), value.getPriority(), value.getValidFrom(), value.getValidTo());
    }

    private Map<String, HrEmployee> employees(Collection<String> codes) {
        List<String> normalized = codes.stream().filter(Objects::nonNull).map(this::normalizeCode).distinct().toList();
        if (normalized.isEmpty()) return Map.of();
        return employeeRepository.findAttendanceEmployeesByCodes(normalized).stream()
                .collect(Collectors.toMap(value -> normalizeCode(value.getEmployeeCode()), Function.identity()));
    }

    private HrEmployee employee(String employeeCode) {
        return employeeRepository.findByEmployeeCode(normalizeCode(employeeCode))
                .orElseThrow(() -> HrApiException.notFound("HR_EMPLOYEE_NOT_FOUND", "Không tìm thấy mã nhân viên."));
    }

    private HrProductionAttendanceImport importBatch(String id) {
        return importRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("PRODUCTION_ATTENDANCE_IMPORT_NOT_FOUND", "Không tìm thấy đợt chấm công."));
    }

    private HrProductionAttendanceImport editableImport(String id) {
        HrProductionAttendanceImport batch = importBatch(id);
        if (batch.getStatus() != HrAttendanceImportStatus.PREVIEWED) {
            throw HrApiException.conflict("PRODUCTION_ATTENDANCE_IMPORT_LOCKED", "Đợt chấm công đã chốt, không thể sửa hoặc tính lại.");
        }
        return batch;
    }

    private HrProductionAttendanceShift activeShift(String id) {
        HrProductionAttendanceShift shift = shiftRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_SHIFT_NOT_FOUND", "Không tìm thấy ca chấm công."));
        if (!shift.isActive()) throw HrApiException.conflict("ATTENDANCE_SHIFT_REVISION_OLD", "Đây là kết quả tính cũ, chỉ được xem lịch sử.");
        return shift;
    }

    private HrAttendanceShiftPolicy policy(String id) {
        return shiftPolicyRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_SHIFT_POLICY_NOT_FOUND", "Không tìm thấy cấu hình ca."));
    }

    private HrAttendanceIncident draftIncident(String id) {
        HrAttendanceIncident incident = incidentRepository.findById(id)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố máy."));
        if (incident.getStatus() != HrAttendanceIncidentStatus.DRAFT) {
            throw HrApiException.conflict("ATTENDANCE_INCIDENT_NOT_DRAFT", "Chỉ bản nháp sự cố mới được thay đổi.");
        }
        return incident;
    }

    private HrProductionAttendanceDtos.ShiftPolicyResponse toPolicyResponse(HrAttendanceShiftPolicy value) {
        return new HrProductionAttendanceDtos.ShiftPolicyResponse(value.getId(), value.getCode(), value.getName(), value.getPolicyGroup(),
                value.getStandardStart(), value.getStandardEnd(), value.getCheckInFrom(), value.getCheckInUntil(),
                value.getCheckOutFrom(), value.getCheckOutUntil(), value.isCrossesMidnight(), value.getNightAllowanceAmount(),
                value.getPriority(), value.isActive(), value.getValidFrom(), value.getValidTo(), value.getRowVersion());
    }

    private HrProductionAttendanceDtos.EmployeePolicyResponse toEmployeePolicy(HrEmployeeAttendancePolicy value, String code) {
        return new HrProductionAttendanceDtos.EmployeePolicyResponse(value.getId(), code, value.getPolicyGroup(),
                value.getValidFrom(), value.getValidTo(), value.getSource(), value.getReason());
    }

    private HrProductionAttendanceDtos.ExemptionResponse toExemption(HrAttendanceExemption value) {
        return new HrProductionAttendanceDtos.ExemptionResponse(value.getId(), value.getEmployeeCode(), value.getValidFrom(),
                value.getValidTo(), value.getReason(), value.getStatus(), value.getConfirmedAt(), value.getConfirmedByActor(),
                value.getCancelledAt(), value.getCancelledByActor(), value.getCancellationReason(), value.getRowVersion());
    }

    private HrProductionAttendanceDtos.ImportResponse toImportResponse(HrProductionAttendanceImport value) {
        return new HrProductionAttendanceDtos.ImportResponse(value.getId(), value.getSourceFileName(), value.getSourceSheetName(),
                value.getAttendanceMonth(), value.getStatus(), value.getProcessingVersion(), value.getTotalRows(), value.getTotalPunches(),
                value.getAutoMatchedShifts(), value.getReviewShifts(), value.getNoPunchRows(), value.getExcludedRows(),
                value.getCreatedAt(), value.getConfirmedAt());
    }

    private HrProductionAttendanceDtos.PunchResponse toPunchResponse(HrAttendancePunch value) {
        return new HrProductionAttendanceDtos.PunchResponse(value.getId(), value.getEmployeeCode(), value.getEmployeeName(),
                value.getWorkDate(), value.getPunchedAt(), value.getSourceRowNumber(), value.getSourceColumn(), value.getRawValue());
    }

    private HrProductionAttendanceDtos.ShiftResponse toShiftResponse(HrProductionAttendanceShift value) {
        return new HrProductionAttendanceDtos.ShiftResponse(value.getId(), value.getImportId(), value.getEmployeeCode(), value.getEmployeeName(),
                value.getWorkDate(), value.getCalculationVersion(), value.getPolicyGroup(), value.getShiftCodeSnapshot(),
                value.getCheckInAt(), value.getCheckOutAt(), value.getWorkValue(), value.getNightAllowanceAmount(), value.getStatus(),
                value.getResolutionType(), value.getExplanation(), value.getIncidentId(), value.getConfirmedAt(),
                value.getConfirmedByActor(), value.getRowVersion());
    }

    private HrProductionAttendanceDtos.IncidentResponse toIncidentResponse(HrAttendanceIncident value) {
        return new HrProductionAttendanceDtos.IncidentResponse(value.getId(), value.getStartedAt(), value.getEndedAt(), value.getScopeType(),
                readList(value.getScopeValuesJson()), value.getDescription(), value.getStatus(), value.getConfirmedAt(), value.getConfirmedByActor());
    }

    private String shiftSnapshot(HrProductionAttendanceShift value) {
        return writeJson(Map.ofEntries(
                Map.entry("status", value.getStatus().name()),
                Map.entry("resolutionType", value.getResolutionType().name()),
                Map.entry("shiftCode", Objects.toString(value.getShiftCodeSnapshot(), "")),
                Map.entry("checkInAt", Objects.toString(value.getCheckInAt(), "")),
                Map.entry("checkOutAt", Objects.toString(value.getCheckOutAt(), "")),
                Map.entry("workValue", value.getWorkValue()),
                Map.entry("nightAllowance", value.getNightAllowanceAmount()),
                Map.entry("incidentId", Objects.toString(value.getIncidentId(), ""))));
    }

    private void audit(HrImportActor actor, String action, String type, String id,
                       List<String> changedFields, Map<String, ?> metadata) {
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

    private void initialize(HrAuditable value, HrImportActor actor) {
        value.setCreatedByActor(actor.subject());
        value.setUpdatedByActor(actor.subject());
    }

    private void touch(HrAuditable value, HrImportActor actor) { value.setUpdatedByActor(actor.subject()); }

    private void validateDates(LocalDate from, LocalDate to) {
        if (to != null && to.isBefore(from)) {
            throw HrApiException.badRequest("ATTENDANCE_VALIDITY_INVALID", "Ngày kết thúc không được trước ngày bắt đầu.");
        }
    }

    private void validateWindow(LocalTime from, LocalTime to, String label) {
        if (to.isBefore(from)) throw HrApiException.badRequest("ATTENDANCE_WINDOW_INVALID", "Thời gian kết thúc " + label + " không được trước thời gian bắt đầu.");
    }

    private void validateWorkValue(BigDecimal value) {
        boolean valid = VALID_WORK_VALUES.stream().anyMatch(allowed -> allowed.compareTo(value) == 0);
        if (!valid) throw HrApiException.badRequest("ATTENDANCE_WORK_VALUE_INVALID", "Công chỉ được nhận 0, 1, 1.5 hoặc 2.");
    }

    private static boolean between(LocalDate value, LocalDate from, LocalDate to) {
        return !value.isBefore(from) && !value.isAfter(to);
    }

    private List<String> normalizeScope(List<String> values) {
        return values == null ? List.of() : values.stream().filter(Objects::nonNull).map(String::trim)
                .filter(value -> !value.isBlank()).distinct().toList();
    }

    private String normalizeCode(String code) { return code == null ? "" : code.trim().toUpperCase(Locale.ROOT); }
    private String safeFileName(String name) { return name == null || name.isBlank() ? "attendance.xlsx" : name.replaceAll("[\\r\\n]", "_").trim(); }
    private LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Không thể tạo JSON audit.", ex); }
    }

    private List<String> readList(String value) {
        try { return objectMapper.readValue(value, new TypeReference<List<String>>() { }); }
        catch (JsonProcessingException ex) { return List.of(); }
    }

    private String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception ex) { throw new IllegalStateException("Không thể tính checksum.", ex); }
    }
}

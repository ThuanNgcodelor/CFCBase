package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrMovementAdjustmentRequest;
import com.booking.system.hr.api.dto.HrMovementCreateRequest;
import com.booking.system.hr.api.dto.HrMovementResponse;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.entity.HrEmploymentContract;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.entity.HrMonthlyRosterItem;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementSourceKind;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.enums.HrRosterInclusionReason;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrExcelImportRowRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.hr.repository.HrProbationCandidateRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class HrWorkforceService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final EnumSet<HrMovementType> SNAPSHOT_MOVEMENT_TYPES = EnumSet.of(
            HrMovementType.INCREASE,
            HrMovementType.DECREASE,
            HrMovementType.REHIRE
    );

    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeMovementRepository movementRepository;
    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final HrExcelImportRowRepository importRowRepository;
    private final HrProbationCandidateRepository probationCandidateRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final EntityManager entityManager;
    private final HrLeaveEntitlementService leaveEntitlementService;
    private final HrEmploymentContractService employmentContractService;

    @Transactional
    public HrMovementResponse createMovement(HrMovementCreateRequest request, HrImportActor actor) {
        requireSupportedMovementType(request.movementType());
        String idempotencyKey = requiredText(request.idempotencyKey(), "Khóa chống trùng là bắt buộc.");
        HrEmployee employee = lockedEmployee(request.employeeId());

        HrEmployeeMovement existing = movementRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existing != null) {
            if (Objects.equals(existing.getEmployee().getId(), request.employeeId())
                    && existing.getMovementType() == request.movementType()
                    && Objects.equals(existing.getEffectiveDate(), request.effectiveDate())) {
                return HrMovementResponse.from(existing);
            }
            throw HrApiException.conflict("MOVEMENT_IDEMPOTENCY_CONFLICT",
                    "Khóa chống trùng đã được dùng cho một biến động khác.");
        }

        if (movementRepository.existsByEmployee_IdAndStatus(employee.getId(), HrMovementStatus.DRAFT)) {
            throw HrApiException.conflict("EMPLOYEE_HAS_DRAFT_MOVEMENT",
                    "Nhân sự đang có một biến động nháp chưa được xử lý.");
        }
        if (request.decisionDate() != null && request.decisionDate().isAfter(today())) {
            throw HrApiException.badRequest("DECISION_DATE_IN_FUTURE",
                    "Ngày ký quyết định không được nằm trong tương lai.");
        }

        HrEmployeeMovement movement = new HrEmployeeMovement();
        movement.setEmployee(employee);
        movement.setMovementType(request.movementType());
        movement.setStatus(HrMovementStatus.DRAFT);
        movement.setEffectiveDate(request.effectiveDate());
        movement.setReason(trimToNull(request.reason()));
        movement.setDecisionNumber(trimToNull(request.decisionNumber()));
        movement.setDecisionDate(request.decisionDate());
        movement.setSourceKind(HrMovementSourceKind.MANUAL);
        movement.setIdempotencyKey(idempotencyKey);

        HrEmployeeEmployment employment = employee.getEmployment();
        if (request.movementType() == HrMovementType.INCREASE) {
            if (employee.getEmploymentStatus() != HrEmploymentStatus.DRAFT) {
                throw HrApiException.conflict("INCREASE_REQUIRES_DRAFT_EMPLOYEE",
                        "Tăng nhân sự chỉ áp dụng cho hồ sơ nhân sự nháp.");
            }
            employmentContractService.requireReadyForIncrease(employee, request.effectiveDate());
            movement.setFromEmployeeStatus(HrEmploymentStatus.DRAFT);
            movement.setToEmployeeStatus(HrEmploymentStatus.ACTIVE);
            movement.setToDepartment(employment == null ? null : employment.getDepartment());
            movement.setToPosition(employment == null ? null : employment.getPosition());
            movement.setToWorkingCondition(employment == null ? null : employment.getWorkingCondition());
        } else {
            if (employee.getEmploymentStatus() != HrEmploymentStatus.ACTIVE) {
                throw HrApiException.conflict("DECREASE_REQUIRES_ACTIVE_EMPLOYEE",
                        "Giảm nhân sự chỉ áp dụng cho người đang làm việc.");
            }
            if (movement.getReason() == null) {
                throw HrApiException.badRequest("DECREASE_REASON_REQUIRED",
                        "Vui lòng nhập lý do giảm nhân sự.");
            }
            movement.setFromEmployeeStatus(HrEmploymentStatus.ACTIVE);
            movement.setToEmployeeStatus(HrEmploymentStatus.INACTIVE);
            movement.setFromDepartment(employment == null ? null : employment.getDepartment());
            movement.setFromPosition(employment == null ? null : employment.getPosition());
            movement.setFromWorkingCondition(employment == null ? null : employment.getWorkingCondition());
        }

        setCreatedAudit(movement, actor);
        movement = movementRepository.save(movement);
        audit(actor, "HR_MOVEMENT_CREATED", "HR_EMPLOYEE_MOVEMENT", movement.getId(),
                List.of("movementType", "effectiveDate", "reason", "decisionNumber", "decisionDate"),
                Map.of("movementType", movement.getMovementType().name(), "employeeId", employee.getId()));
        entityManager.flush();
        return HrMovementResponse.from(movement);
    }

    /**
     * A correction is a new draft linked to one confirmed manual movement. The
     * original movement remains immutable and is retained for audit.
     */
    @Transactional
    public HrMovementResponse createAdjustment(
            String targetMovementId,
            HrMovementAdjustmentRequest request,
            HrImportActor actor
    ) {
        HrEmployeeMovement target = lockedMovement(targetMovementId);
        requireVersion(target.getRowVersion(), request.rowVersion(),
                "Biến động gốc đã được cập nhật ở nơi khác.");
        if (target.getStatus() != HrMovementStatus.CONFIRMED || target.getSourceKind() != HrMovementSourceKind.MANUAL) {
            throw HrApiException.conflict("MOVEMENT_ADJUSTMENT_NOT_ALLOWED",
                    "Chỉ biến động nhập tay đã xác nhận mới có thể được điều chỉnh.");
        }
        if (target.getCorrectionOfMovement() != null
                || movementRepository.existsByCorrectionOfMovement_IdAndStatus(target.getId(), HrMovementStatus.CONFIRMED)) {
            throw HrApiException.conflict("MOVEMENT_ALREADY_ADJUSTED",
                    "Biến động này đã có bản điều chỉnh xác nhận. Hãy tạo biến động mới nếu phát sinh nghiệp vụ tiếp theo.");
        }
        requireValidAdjustmentType(target.getMovementType(), request.replacementMovementType());
        if (request.decisionDate() != null && request.decisionDate().isAfter(today())) {
            throw HrApiException.badRequest("DECISION_DATE_IN_FUTURE",
                    "Ngày ký quyết định không được nằm trong tương lai.");
        }
        String idempotencyKey = requiredText(request.idempotencyKey(), "Khóa chống trùng là bắt buộc.");
        HrEmployeeMovement existing = movementRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existing != null) {
            if (existing.getCorrectionOfMovement() != null
                    && Objects.equals(existing.getCorrectionOfMovement().getId(), target.getId())
                    && existing.getMovementType() == request.replacementMovementType()
                    && Objects.equals(existing.getEffectiveDate(), request.effectiveDate())) {
                return HrMovementResponse.from(existing);
            }
            throw HrApiException.conflict("MOVEMENT_IDEMPOTENCY_CONFLICT",
                    "Khóa chống trùng đã được dùng cho một biến động khác.");
        }

        HrEmployee employee = lockedEmployee(target.getEmployee().getId());
        if (movementRepository.existsByEmployee_IdAndStatus(employee.getId(), HrMovementStatus.DRAFT)) {
            throw HrApiException.conflict("EMPLOYEE_HAS_DRAFT_MOVEMENT",
                    "Nhân sự đang có một biến động nháp chưa được xử lý.");
        }
        if (movementRepository.existsConfirmedManualMovementAtOrAfter(
                employee.getId(), HrMovementStatus.CONFIRMED, HrMovementSourceKind.MANUAL,
                target.getId(), target.getEffectiveDate())) {
            throw HrApiException.conflict("MOVEMENT_ADJUSTMENT_HAS_DOWNSTREAM_HISTORY",
                    "Không thể điều chỉnh vì nhân sự đã có biến động xác nhận cùng hoặc sau ngày hiệu lực. Hãy tạo biến động mới.");
        }

        HrEmployeeMovement adjustment = new HrEmployeeMovement();
        adjustment.setEmployee(employee);
        adjustment.setMovementType(request.replacementMovementType());
        adjustment.setStatus(HrMovementStatus.DRAFT);
        adjustment.setEffectiveDate(request.effectiveDate());
        adjustment.setReason(requiredText(request.reason(), "Vui lòng nhập lý do điều chỉnh."));
        adjustment.setDecisionNumber(trimToNull(request.decisionNumber()));
        adjustment.setDecisionDate(request.decisionDate());
        adjustment.setSourceKind(HrMovementSourceKind.MANUAL);
        adjustment.setCorrectionOfMovement(target);
        adjustment.setIdempotencyKey(idempotencyKey);
        setAdjustmentRoute(adjustment, target, employee.getEmployment());
        setCreatedAudit(adjustment, actor);
        adjustment = movementRepository.save(adjustment);
        audit(actor, "HR_MOVEMENT_ADJUSTMENT_CREATED", "HR_EMPLOYEE_MOVEMENT", adjustment.getId(),
                List.of("correctionOfMovementId", "movementType", "effectiveDate", "reason"),
                Map.of(
                        "employeeId", employee.getId(),
                        "correctionOfMovementId", target.getId(),
                        "originalMovementType", target.getMovementType().name(),
                        "replacementMovementType", adjustment.getMovementType().name()
                ));
        entityManager.flush();
        return HrMovementResponse.from(adjustment);
    }

    @Transactional
    public HrMovementResponse confirmMovement(String movementId, long rowVersion, HrImportActor actor) {
        HrEmployeeMovement movement = lockedMovement(movementId);
        if (movement.getStatus() == HrMovementStatus.CONFIRMED) {
            return HrMovementResponse.from(movement);
        }
        if (movement.getStatus() != HrMovementStatus.DRAFT) {
            throw HrApiException.conflict("MOVEMENT_NOT_DRAFT",
                    "Chỉ biến động nháp mới có thể được xác nhận.");
        }
        requireVersion(movement.getRowVersion(), rowVersion, "Biến động đã được cập nhật ở nơi khác.");

        if (movement.getCorrectionOfMovement() != null) {
            return confirmAdjustmentMovement(movement, actor);
        }
        return confirmStandardMovement(movement, actor);
    }

    @Transactional
    public List<HrMovementResponse> bulkConfirmMovements(List<String> movementIds, HrImportActor actor) {
        if (movementIds == null || movementIds.isEmpty()) {
            throw HrApiException.badRequest("BULK_MOVEMENT_EMPTY", "Danh sách biến động không được rỗng.");
        }
        List<HrMovementResponse> responses = new ArrayList<>();
        for (String id : movementIds) {
            HrEmployeeMovement movement = lockedMovement(id);
            if (movement.getStatus() == HrMovementStatus.DRAFT) {
                responses.add(confirmMovement(id, movement.getRowVersion(), actor));
            }
        }
        return responses;
    }

    @Transactional
    public List<HrMovementResponse> bulkCancelMovements(List<String> movementIds, HrImportActor actor) {
        if (movementIds == null || movementIds.isEmpty()) {
            throw HrApiException.badRequest("BULK_MOVEMENT_EMPTY", "Danh sách biến động không được rỗng.");
        }
        List<HrMovementResponse> responses = new ArrayList<>();
        for (String id : movementIds) {
            HrEmployeeMovement movement = lockedMovement(id);
            if (movement.getStatus() == HrMovementStatus.DRAFT) {
                responses.add(cancelMovement(id, movement.getRowVersion(), actor));
            }
        }
        return responses;
    }

    private HrMovementResponse confirmStandardMovement(HrEmployeeMovement movement, HrImportActor actor) {
        HrEmployee employee = lockedEmployee(movement.getEmployee().getId());
        HrEmployeeEmployment employment = employee.getEmployment();
        HrEmploymentContract activationContract = null;
        if (employee.getStatusEffectiveDate() != null
                && movement.getEffectiveDate().isBefore(employee.getStatusEffectiveDate())) {
            throw HrApiException.conflict("MOVEMENT_BEFORE_CURRENT_STATUS",
                    "Ngày hiệu lực không được trước trạng thái hiện tại của nhân sự.");
        }

        if (movement.getMovementType() == HrMovementType.INCREASE) {
            if (employee.getEmploymentStatus() != HrEmploymentStatus.DRAFT) {
                throw HrApiException.conflict("INCREASE_REQUIRES_DRAFT_EMPLOYEE",
                        "Hồ sơ không còn ở trạng thái nháp để xác nhận tăng.");
            }
            activationContract = employmentContractService.requireReadyForIncrease(
                    employee, movement.getEffectiveDate());
            employee.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
            employee.setStatusEffectiveDate(movement.getEffectiveDate());
            if (employment != null) {
                if (employment.getHireDate() == null) employment.setHireDate(movement.getEffectiveDate());
                employment.setTerminationDate(null);
                touch(employment, actor);
            }
        } else if (movement.getMovementType() == HrMovementType.DECREASE) {
            if (employee.getEmploymentStatus() != HrEmploymentStatus.ACTIVE) {
                throw HrApiException.conflict("DECREASE_REQUIRES_ACTIVE_EMPLOYEE",
                        "Nhân sự không còn ở trạng thái đang làm việc để xác nhận giảm.");
            }
            employee.setEmploymentStatus(HrEmploymentStatus.INACTIVE);
            employee.setStatusEffectiveDate(movement.getEffectiveDate());
            if (employment != null) {
                if (employment.getHireDate() != null
                        && movement.getEffectiveDate().isBefore(employment.getHireDate())) {
                    throw HrApiException.badRequest("DECREASE_BEFORE_HIRE_DATE",
                            "Ngày giảm không được trước ngày vào làm.");
                }
                employment.setTerminationDate(movement.getEffectiveDate());
                touch(employment, actor);
            }
        } else {
            throw HrApiException.badRequest("MOVEMENT_TYPE_NOT_SUPPORTED",
                    "Phase 5 chỉ hỗ trợ xác nhận Tăng và Giảm nhân sự.");
        }

        employmentContractService.markEffective(activationContract, actor);

        confirmMovementAudit(movement, employee, actor, "HR_MOVEMENT_CONFIRMED", Map.of(
                "movementType", movement.getMovementType().name(), "employeeId", employee.getId()));
        return HrMovementResponse.from(movement);
    }

    private HrMovementResponse confirmAdjustmentMovement(HrEmployeeMovement movement, HrImportActor actor) {
        HrEmployeeMovement target = lockedMovement(movement.getCorrectionOfMovement().getId());
        if (target.getStatus() != HrMovementStatus.CONFIRMED || target.getSourceKind() != HrMovementSourceKind.MANUAL) {
            throw HrApiException.conflict("MOVEMENT_ADJUSTMENT_TARGET_INVALID",
                    "Biến động gốc không còn phù hợp để điều chỉnh.");
        }
        requireValidAdjustmentType(target.getMovementType(), movement.getMovementType());
        if (movementRepository.existsByCorrectionOfMovement_IdAndStatus(target.getId(), HrMovementStatus.CONFIRMED)) {
            throw HrApiException.conflict("MOVEMENT_ALREADY_ADJUSTED",
                    "Biến động gốc đã có bản điều chỉnh xác nhận.");
        }
        HrEmployee employee = lockedEmployee(movement.getEmployee().getId());
        if (movementRepository.existsConfirmedManualMovementAtOrAfter(
                employee.getId(), HrMovementStatus.CONFIRMED, HrMovementSourceKind.MANUAL,
                target.getId(), target.getEffectiveDate())) {
            throw HrApiException.conflict("MOVEMENT_ADJUSTMENT_HAS_DOWNSTREAM_HISTORY",
                    "Không thể xác nhận điều chỉnh vì nhân sự đã có biến động xác nhận tiếp theo.");
        }
        applyAdjustedEmploymentStatus(employee, movement, actor);
        confirmMovementAudit(movement, employee, actor, "HR_MOVEMENT_ADJUSTMENT_CONFIRMED", Map.of(
                "employeeId", employee.getId(),
                "correctionOfMovementId", target.getId(),
                "originalMovementType", target.getMovementType().name(),
                "replacementMovementType", movement.getMovementType().name()
        ));
        return HrMovementResponse.from(movement);
    }

    private void applyAdjustedEmploymentStatus(HrEmployee employee, HrEmployeeMovement movement, HrImportActor actor) {
        HrEmployeeEmployment employment = employee.getEmployment();
        if (movement.getMovementType() == HrMovementType.INCREASE || movement.getMovementType() == HrMovementType.REHIRE) {
            employee.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
            employee.setStatusEffectiveDate(movement.getEffectiveDate());
            if (employment != null) {
                if (employment.getHireDate() == null) {
                    employment.setHireDate(movement.getEffectiveDate());
                }
                employment.setTerminationDate(null);
                touch(employment, actor);
            }
            return;
        }
        if (movement.getMovementType() == HrMovementType.DECREASE) {
            employee.setEmploymentStatus(HrEmploymentStatus.INACTIVE);
            employee.setStatusEffectiveDate(movement.getEffectiveDate());
            if (employment != null) {
                if (employment.getHireDate() != null && movement.getEffectiveDate().isBefore(employment.getHireDate())) {
                    throw HrApiException.badRequest("DECREASE_BEFORE_HIRE_DATE",
                            "Ngày giảm không được trước ngày vào làm.");
                }
                employment.setTerminationDate(movement.getEffectiveDate());
                touch(employment, actor);
            }
            return;
        }
        throw HrApiException.badRequest("MOVEMENT_TYPE_NOT_SUPPORTED",
                "Loại điều chỉnh không được hỗ trợ.");
    }

    private void confirmMovementAudit(
            HrEmployeeMovement movement,
            HrEmployee employee,
            HrImportActor actor,
            String action,
            Map<String, ?> metadata
    ) {
        LocalDateTime now = nowUtc();
        touch(employee, actor);
        movement.setStatus(HrMovementStatus.CONFIRMED);
        movement.setConfirmedAt(now);
        movement.setConfirmedByActor(displayActor(actor));
        touch(movement, actor);
        movementRepository.save(movement);
        audit(actor, action, "HR_EMPLOYEE_MOVEMENT", movement.getId(),
                List.of("status", "confirmedAt", "employeeStatus"),
                metadata);
        entityManager.flush();
    }

    @Transactional
    public HrMovementResponse cancelMovement(String movementId, long rowVersion, HrImportActor actor) {
        HrEmployeeMovement movement = lockedMovement(movementId);
        if (movement.getStatus() == HrMovementStatus.CANCELLED) {
            return HrMovementResponse.from(movement);
        }
        if (movement.getStatus() != HrMovementStatus.DRAFT) {
            throw HrApiException.conflict("CONFIRMED_MOVEMENT_IMMUTABLE",
                    "Biến động đã xác nhận không thể hủy; hãy tạo nghiệp vụ bù khi cần điều chỉnh.");
        }
        requireVersion(movement.getRowVersion(), rowVersion, "Biến động đã được cập nhật ở nơi khác.");

        movement.setStatus(HrMovementStatus.CANCELLED);
        movement.setCancelledAt(nowUtc());
        movement.setCancelledByActor(displayActor(actor));
        touch(movement, actor);
        movementRepository.save(movement);
        audit(actor, "HR_MOVEMENT_CANCELLED", "HR_EMPLOYEE_MOVEMENT", movement.getId(),
                List.of("status", "cancelledAt"), Map.of("movementType", movement.getMovementType().name()));
        entityManager.flush();
        return HrMovementResponse.from(movement);
    }

    @Transactional
    public void deleteDraftMovement(String movementId, long rowVersion, HrImportActor actor) {
        HrEmployeeMovement movement = lockedMovement(movementId);
        if (movement.getStatus() != HrMovementStatus.DRAFT || movement.getImportBatch() != null) {
            throw HrApiException.conflict("MOVEMENT_DELETE_NOT_ALLOWED",
                    "Chỉ biến động nháp nhập tay và chưa phát sinh liên kết mới được xóa.");
        }
        requireVersion(movement.getRowVersion(), rowVersion, "Biến động đã được cập nhật ở nơi khác.");
        if (rosterItemRepository.countBySourceMovement_Id(movementId) > 0
                || importRowRepository.countByMovement_Id(movementId) > 0) {
            throw HrApiException.conflict("MOVEMENT_HAS_REFERENCES",
                    "Biến động đã được danh sách tháng hoặc lần nhập tham chiếu.");
        }
        audit(actor, "HR_MOVEMENT_DRAFT_DELETED", "HR_EMPLOYEE_MOVEMENT", movementId,
                List.of("deleted"), Map.of("movementType", movement.getMovementType().name()));
        entityManager.remove(movement);
        entityManager.flush();
    }

    @Transactional
    public void deleteDraftEmployee(String employeeId, long rowVersion, HrImportActor actor) {
        HrEmployee employee = lockedEmployee(employeeId);
        if (employee.getEmploymentStatus() != HrEmploymentStatus.DRAFT || employee.getSourceImportBatch() != null) {
            throw HrApiException.conflict("EMPLOYEE_DELETE_NOT_ALLOWED",
                    "Chỉ hồ sơ nhân sự nháp tạo thủ công mới được xóa.");
        }
        requireVersion(employee.getRowVersion(), rowVersion, "Hồ sơ đã được cập nhật ở nơi khác.");
        if (movementRepository.countByEmployee_Id(employeeId) > 0
                || rosterItemRepository.countByEmployee_Id(employeeId) > 0
                || importRowRepository.countByEmployee_Id(employeeId) > 0
                || probationCandidateRepository.existsByConvertedEmployee_Id(employeeId)) {
            throw HrApiException.conflict("EMPLOYEE_HAS_REFERENCES",
                    "Hồ sơ đã có ứng viên nguồn, biến động, snapshot hoặc dữ liệu import tham chiếu.");
        }
        audit(actor, "HR_EMPLOYEE_DRAFT_DELETED", "HR_EMPLOYEE", employeeId,
                List.of("deleted"), Map.of("employeeCode", employee.getEmployeeCode()));
        entityManager.remove(employee);
        entityManager.flush();
    }

    @Transactional
    public HrRosterResponse createRoster(LocalDate periodStart, HrImportActor actor) {
        LocalDate normalizedPeriod = requirePeriodStart(periodStart);
        HrMonthlyRoster existing = rosterRepository.findByPeriodStart(normalizedPeriod).orElse(null);
        if (existing != null) return HrRosterResponse.from(existing);

        HrMonthlyRoster latest = rosterRepository.findTopByOrderByPeriodStartDesc()
                .orElseThrow(() -> HrApiException.conflict("ROSTER_SOURCE_MISSING",
                        "Cần xác nhận baseline T6 trước khi tạo danh sách tháng tiếp theo."));
        if (latest.getPeriodStart().equals(normalizedPeriod)) {
            return HrRosterResponse.from(latest);
        }
        if (latest.getStatus() != HrRosterStatus.CLOSED && latest.getStatus() != HrRosterStatus.EXPORTED) {
            throw HrApiException.conflict("PREVIOUS_ROSTER_NOT_CLOSED",
                    "Danh sách tháng gần nhất phải được chốt trước khi tạo tháng mới.");
        }
        if (!latest.getPeriodStart().plusMonths(1).equals(normalizedPeriod)) {
            throw HrApiException.badRequest("ROSTER_PERIOD_NOT_SEQUENTIAL",
                    "Chỉ được tạo tháng liền sau danh sách gần nhất.");
        }

        HrMonthlyRoster roster = new HrMonthlyRoster();
        roster.setPeriodStart(normalizedPeriod);
        roster.setStatus(HrRosterStatus.DRAFT);
        roster.setSourceRoster(latest);
        roster.setSnapshotSchemaVersion((short) 1);
        roster.setItemCount(0);
        setCreatedAudit(roster, actor);
        roster = rosterRepository.save(roster);
        audit(actor, "HR_ROSTER_CREATED", "HR_MONTHLY_ROSTER", roster.getId(),
                List.of("periodStart", "status", "sourceRosterId"),
                Map.of("periodStart", normalizedPeriod.toString(), "sourceRosterId", latest.getId()));
        entityManager.flush();
        return HrRosterResponse.from(roster);
    }

    @Transactional
    public HrRosterResponse openRoster(String rosterId, long rowVersion, HrImportActor actor) {
        HrMonthlyRoster roster = lockedRoster(rosterId);
        if (roster.getStatus() == HrRosterStatus.OPEN) return HrRosterResponse.from(roster);
        if (roster.getStatus() != HrRosterStatus.DRAFT) {
            throw HrApiException.conflict("ROSTER_NOT_DRAFT", "Chỉ danh sách nháp mới có thể mở.");
        }
        requireVersion(roster.getRowVersion(), rowVersion, "Danh sách tháng đã được cập nhật ở nơi khác.");

        materializeRoster(roster, actor);
        roster.setStatus(HrRosterStatus.OPEN);
        roster.setOpenedAt(nowUtc());
        roster.setOpenedByActor(actor.subject());
        touch(roster, actor);
        rosterRepository.save(roster);
        audit(actor, "HR_ROSTER_OPENED", "HR_MONTHLY_ROSTER", roster.getId(),
                List.of("status", "openedAt", "itemCount"),
                Map.of("periodStart", roster.getPeriodStart().toString(), "itemCount", roster.getItemCount()));
        entityManager.flush();
        return HrRosterResponse.from(roster);
    }

    @Transactional
    public HrRosterResponse closeRoster(String rosterId, long rowVersion, HrImportActor actor) {
        HrMonthlyRoster roster = lockedRoster(rosterId);
        if (roster.getStatus() == HrRosterStatus.CLOSED) return HrRosterResponse.from(roster);
        if (roster.getStatus() != HrRosterStatus.OPEN) {
            throw HrApiException.conflict("ROSTER_NOT_OPEN", "Chỉ danh sách đang mở mới có thể chốt.");
        }
        requireVersion(roster.getRowVersion(), rowVersion, "Danh sách tháng đã được cập nhật ở nơi khác.");
        LocalDate currentMonth = today().withDayOfMonth(1);
        if (roster.getPeriodStart().isAfter(currentMonth)) {
            throw HrApiException.badRequest("FUTURE_ROSTER_CANNOT_CLOSE",
                    "Không thể chốt danh sách của một tháng chưa bắt đầu.");
        }

        materializeRoster(roster, actor);
        roster.setStatus(HrRosterStatus.CLOSED);
        roster.setClosedAt(nowUtc());
        roster.setClosedByActor(actor.subject());
        touch(roster, actor);
        rosterRepository.save(roster);
        audit(actor, "HR_ROSTER_CLOSED", "HR_MONTHLY_ROSTER", roster.getId(),
                List.of("status", "closedAt", "itemCount", "rosterChecksum"),
                Map.of("periodStart", roster.getPeriodStart().toString(), "itemCount", roster.getItemCount()));
        entityManager.flush();
        return HrRosterResponse.from(roster);
    }

    @Transactional
    public HrRosterResponse reopenRoster(
            String rosterId,
            long rowVersion,
            String reason,
            HrImportActor actor
    ) {
        HrMonthlyRoster roster = lockedRoster(rosterId);
        if (roster.getStatus() == HrRosterStatus.OPEN) return HrRosterResponse.from(roster);
        if (roster.getStatus() != HrRosterStatus.CLOSED) {
            throw HrApiException.conflict("ROSTER_REOPEN_NOT_ALLOWED",
                    "Chỉ danh sách đã chốt và chưa xuất mới có thể mở lại.");
        }
        requireVersion(roster.getRowVersion(), rowVersion, "Danh sách tháng đã được cập nhật ở nơi khác.");
        String safeReason = requiredText(reason, "Vui lòng nhập lý do mở lại danh sách tháng.");
        if (roster.getSourceImportBatch() != null) {
            throw HrApiException.conflict("BASELINE_ROSTER_IMMUTABLE",
                    "Danh sách baseline T6 đã khóa và không thể mở lại.");
        }
        if (rosterRepository.existsBySourceRoster_Id(rosterId)) {
            throw HrApiException.conflict("ROSTER_HAS_DOWNSTREAM_PERIOD",
                    "Không thể mở lại vì tháng sau đã kế thừa danh sách này.");
        }

        roster.setStatus(HrRosterStatus.OPEN);
        roster.setClosedAt(null);
        roster.setClosedByActor(null);
        roster.setRosterChecksum(null);
        touch(roster, actor);
        rosterRepository.save(roster);
        audit(actor, "HR_ROSTER_REOPENED", "HR_MONTHLY_ROSTER", roster.getId(),
                List.of("status", "closedAt", "rosterChecksum"),
                Map.of("periodStart", roster.getPeriodStart().toString(), "reason", safeReason));
        entityManager.flush();
        return HrRosterResponse.from(roster);
    }

    @Transactional
    public void deleteDraftRoster(String rosterId, long rowVersion, HrImportActor actor) {
        HrMonthlyRoster roster = lockedRoster(rosterId);
        if (roster.getStatus() != HrRosterStatus.DRAFT || roster.getSourceImportBatch() != null) {
            throw HrApiException.conflict("ROSTER_DELETE_NOT_ALLOWED",
                    "Chỉ danh sách tháng nháp chưa phát sinh dữ liệu mới được xóa.");
        }
        requireVersion(roster.getRowVersion(), rowVersion, "Danh sách tháng đã được cập nhật ở nơi khác.");
        if (rosterRepository.existsBySourceRoster_Id(rosterId)
                || rosterItemRepository.countByRoster_Id(rosterId) > 0) {
            throw HrApiException.conflict("ROSTER_HAS_REFERENCES",
                    "Danh sách tháng đã có dữ liệu hoặc được tháng khác kế thừa.");
        }
        audit(actor, "HR_ROSTER_DRAFT_DELETED", "HR_MONTHLY_ROSTER", rosterId,
                List.of("deleted"), Map.of("periodStart", roster.getPeriodStart().toString()));
        entityManager.remove(roster);
        entityManager.flush();
    }

    private void materializeRoster(HrMonthlyRoster roster, HrImportActor actor) {
        HrMonthlyRoster source = roster.getSourceRoster();
        if (source == null
                || (source.getStatus() != HrRosterStatus.CLOSED && source.getStatus() != HrRosterStatus.EXPORTED)) {
            throw HrApiException.conflict("ROSTER_SOURCE_NOT_CLOSED",
                    "Danh sách nguồn phải tồn tại và đã được chốt.");
        }

        LinkedHashMap<String, SnapshotDraft> snapshots = new LinkedHashMap<>();
        for (HrMonthlyRosterItem item : rosterItemRepository
                .findAllByRoster_IdOrderByDisplayOrder(source.getId())) {
            snapshots.put(item.getEmployee().getId(), SnapshotDraft.fromSource(item));
        }

        LocalDate periodEnd = roster.getPeriodStart().with(TemporalAdjusters.lastDayOfMonth());
        List<HrEmployeeMovement> movements = movementRepository.findConfirmedForProjection(
                HrMovementStatus.CONFIRMED,
                SNAPSHOT_MOVEMENT_TYPES
        );
        java.util.Set<String> supersededMovementIds = new java.util.HashSet<>();
        for (HrEmployeeMovement movement : movements) {
            if (movement.getCorrectionOfMovement() != null) {
                supersededMovementIds.add(movement.getCorrectionOfMovement().getId());
            }
        }
        for (HrEmployeeMovement movement : movements) {
            if (supersededMovementIds.contains(movement.getId()) || movement.getEffectiveDate().isAfter(periodEnd)) {
                continue;
            }
            String employeeId = movement.getEmployee().getId();
            if (movement.getMovementType() == HrMovementType.DECREASE) {
                snapshots.remove(employeeId);
            } else if (!snapshots.containsKey(employeeId)) {
                snapshots.put(employeeId, SnapshotDraft.fromIncrease(movement));
            }
        }

        entityManager.createQuery(
                        "delete from HrMonthlyRosterItem item where item.roster.id = :rosterId")
                .setParameter("rosterId", roster.getId())
                .executeUpdate();
        entityManager.flush();

        List<HrMonthlyRosterItem> items = new ArrayList<>(snapshots.size());
        List<String> hashes = new ArrayList<>(snapshots.size());
        Map<String, HrLeaveEntitlementService.LeaveEntitlementSnapshot> leaveEntitlements =
                leaveEntitlementService.resolveForEmployees(
                        snapshots.values().stream().map(SnapshotDraft::employee).toList(),
                        roster.getPeriodStart().getYear()
                );
        int displayOrder = 1;
        for (SnapshotDraft draft : snapshots.values()) {
            HrLeaveEntitlementService.LeaveEntitlementSnapshot leaveSnapshot =
                    leaveEntitlements.get(draft.employee().getId());
            BigDecimal finalLeaveDays = leaveSnapshot == null ? draft.leaveDays() : leaveSnapshot.finalDays();
            Map<String, Object> payload = draft.payload(displayOrder, finalLeaveDays);
            String snapshotJson = json(payload);
            String payloadHash = sha256(snapshotJson);

            HrMonthlyRosterItem item = new HrMonthlyRosterItem();
            item.setRoster(roster);
            item.setEmployee(draft.employee());
            item.setDisplayOrder(displayOrder++);
            item.setDepartmentDisplayOrder(draft.departmentDisplayOrder());
            item.setEmployeeCode(draft.employeeCode());
            item.setFullName(draft.fullName());
            item.setDepartmentCode(draft.departmentCode());
            item.setDepartmentName(draft.departmentName());
            item.setPositionCode(draft.positionCode());
            item.setPositionName(draft.positionName());
            item.setWorkingConditionCode(draft.workingConditionCode());
            item.setWorkingConditionName(draft.workingConditionName());
            item.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
            item.setHireDate(draft.hireDate());
            item.setTerminationDate(null);
            item.setLeaveDays(finalLeaveDays);
            item.setInclusionReason(draft.inclusionReason());
            item.setSourceMovement(draft.sourceMovement());
            item.setSnapshotSchemaVersion((short) 1);
            item.setSnapshotPayload(snapshotJson);
            item.setPayloadSha256(payloadHash);
            item.setCreatedByActor(actor.subject());
            items.add(item);
            hashes.add(payloadHash);
        }
        rosterItemRepository.saveAll(items);
        roster.setItemCount(items.size());
        roster.setRosterChecksum(sha256(String.join("", hashes)));
    }

    private HrEmployee lockedEmployee(String employeeId) {
        String safeId = requiredText(employeeId, "Mã hồ sơ nhân sự là bắt buộc.");
        return employeeRepository.findDetailByIdForUpdate(safeId)
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND",
                        "Không tìm thấy hồ sơ nhân sự."));
    }

    private HrEmployeeMovement lockedMovement(String movementId) {
        return movementRepository.findByIdForUpdate(requiredText(movementId, "Mã biến động là bắt buộc."))
                .orElseThrow(() -> HrApiException.notFound("MOVEMENT_NOT_FOUND",
                        "Không tìm thấy biến động nhân sự."));
    }

    private HrMonthlyRoster lockedRoster(String rosterId) {
        return rosterRepository.findByIdForUpdate(requiredText(rosterId, "Mã danh sách tháng là bắt buộc."))
                .orElseThrow(() -> HrApiException.notFound("ROSTER_NOT_FOUND",
                        "Không tìm thấy danh sách nhân sự tháng."));
    }

    private static void requireSupportedMovementType(HrMovementType type) {
        if (type != HrMovementType.INCREASE && type != HrMovementType.DECREASE) {
            throw HrApiException.badRequest("MOVEMENT_TYPE_NOT_SUPPORTED",
                    "Phase 5 chỉ hỗ trợ Tăng và Giảm nhân sự.");
        }
    }

    private static void requireValidAdjustmentType(HrMovementType originalType, HrMovementType replacementType) {
        boolean valid = (originalType == HrMovementType.INCREASE
                && (replacementType == HrMovementType.INCREASE || replacementType == HrMovementType.DECREASE))
                || (originalType == HrMovementType.DECREASE
                && (replacementType == HrMovementType.DECREASE || replacementType == HrMovementType.REHIRE))
                || (originalType == HrMovementType.REHIRE
                && (replacementType == HrMovementType.REHIRE || replacementType == HrMovementType.DECREASE));
        if (!valid) {
            throw HrApiException.badRequest("MOVEMENT_ADJUSTMENT_TYPE_INVALID",
                    "Bản điều chỉnh chỉ được đổi ngày hiệu lực hoặc tạo nghiệp vụ bù phù hợp với biến động gốc.");
        }
    }

    private static void setAdjustmentRoute(
            HrEmployeeMovement adjustment,
            HrEmployeeMovement target,
            HrEmployeeEmployment employment
    ) {
        if (adjustment.getMovementType() == target.getMovementType()) {
            adjustment.setFromDepartment(target.getFromDepartment());
            adjustment.setToDepartment(target.getToDepartment());
            adjustment.setFromPosition(target.getFromPosition());
            adjustment.setToPosition(target.getToPosition());
            adjustment.setFromWorkingCondition(target.getFromWorkingCondition());
            adjustment.setToWorkingCondition(target.getToWorkingCondition());
            adjustment.setFromEmployeeStatus(target.getFromEmployeeStatus());
            adjustment.setToEmployeeStatus(target.getToEmployeeStatus());
            return;
        }
        if (adjustment.getMovementType() == HrMovementType.REHIRE) {
            adjustment.setFromEmployeeStatus(HrEmploymentStatus.INACTIVE);
            adjustment.setToEmployeeStatus(HrEmploymentStatus.ACTIVE);
            adjustment.setToDepartment(employment == null ? null : employment.getDepartment());
            adjustment.setToPosition(employment == null ? null : employment.getPosition());
            adjustment.setToWorkingCondition(employment == null ? null : employment.getWorkingCondition());
            return;
        }
        adjustment.setFromEmployeeStatus(HrEmploymentStatus.ACTIVE);
        adjustment.setToEmployeeStatus(HrEmploymentStatus.INACTIVE);
        adjustment.setFromDepartment(employment == null ? null : employment.getDepartment());
        adjustment.setFromPosition(employment == null ? null : employment.getPosition());
        adjustment.setFromWorkingCondition(employment == null ? null : employment.getWorkingCondition());
    }

    private static LocalDate requirePeriodStart(LocalDate value) {
        if (value == null || value.getDayOfMonth() != 1) {
            throw HrApiException.badRequest("ROSTER_PERIOD_INVALID",
                    "Kỳ nhân sự phải là ngày đầu tiên của tháng.");
        }
        return value;
    }

    private static void requireVersion(long actual, long requested, String message) {
        if (actual != requested) {
            throw HrApiException.conflict("STALE_HR_VERSION", message);
        }
    }

    private void audit(
            HrImportActor actor,
            String action,
            String entityType,
            String entityId,
            List<String> changedFields,
            Map<String, ?> metadata
    ) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(entityType);
        event.setEntityId(entityId);
        try {
            event.setChangedFields(jsonCodec.write(changedFields));
            event.setSanitizedMetadata(jsonCodec.write(metadata));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi audit HR đã lọc.", exception);
        }
        auditRepository.save(event);
    }

    private String json(Object value) {
        try {
            return jsonCodec.write(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể tạo snapshot nhân sự tháng.", exception);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 không khả dụng.", exception);
        }
    }

    private static String requiredText(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) throw HrApiException.badRequest("REQUIRED_VALUE", message);
        return normalized;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    private static LocalDate today() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    private static void setCreatedAudit(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private static void touch(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setUpdatedByActor(actor.subject());
        entity.setUpdatedAt(nowUtc());
    }

    private static String displayActor(HrImportActor actor) {
        return actor.displayName() == null ? actor.subject() : actor.displayName();
    }

    private static String code(HrCatalogEntity catalog) {
        return catalog == null ? null : catalog.getCode();
    }

    private static String name(HrCatalogEntity catalog) {
        return catalog == null ? null : catalog.getName();
    }

    private record SnapshotDraft(
            HrEmployee employee,
            Integer departmentDisplayOrder,
            String employeeCode,
            String fullName,
            String departmentCode,
            String departmentName,
            String positionCode,
            String positionName,
            String workingConditionCode,
            String workingConditionName,
            LocalDate hireDate,
            BigDecimal leaveDays,
            HrRosterInclusionReason inclusionReason,
            HrEmployeeMovement sourceMovement
    ) {
        static SnapshotDraft fromSource(HrMonthlyRosterItem source) {
            return new SnapshotDraft(
                    source.getEmployee(),
                    source.getDepartmentDisplayOrder(),
                    source.getEmployeeCode(),
                    source.getFullName(),
                    source.getDepartmentCode(),
                    source.getDepartmentName(),
                    source.getPositionCode(),
                    source.getPositionName(),
                    source.getWorkingConditionCode(),
                    source.getWorkingConditionName(),
                    source.getHireDate(),
                    source.getLeaveDays(),
                    HrRosterInclusionReason.CARRIED_FORWARD,
                    source.getSourceMovement()
            );
        }

        static SnapshotDraft fromIncrease(HrEmployeeMovement movement) {
            HrEmployee employee = movement.getEmployee();
            HrEmployeeEmployment employment = employee.getEmployment();
            return new SnapshotDraft(
                    employee,
                    null,
                    employee.getEmployeeCode(),
                    employee.getFullName(),
                    employment == null ? null : code(employment.getDepartment()),
                    employment == null ? null : name(employment.getDepartment()),
                    employment == null ? null : code(employment.getPosition()),
                    employment == null ? null : name(employment.getPosition()),
                    employment == null ? null : code(employment.getWorkingCondition()),
                    employment == null ? null : name(employment.getWorkingCondition()),
                    employment == null || employment.getHireDate() == null
                            ? movement.getEffectiveDate()
                            : employment.getHireDate(),
                    null,
                    movement.getMovementType() == HrMovementType.REHIRE
                            ? HrRosterInclusionReason.REHIRE
                            : HrRosterInclusionReason.INCREASE,
                    movement
            );
        }

        Map<String, Object> payload(int displayOrder, BigDecimal leaveDays) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("snapshotSchemaVersion", 1);
            payload.put("displayOrder", displayOrder);
            payload.put("departmentDisplayOrder", departmentDisplayOrder);
            payload.put("employeeCode", employeeCode);
            payload.put("fullName", fullName);
            payload.put("departmentCode", departmentCode);
            payload.put("departmentName", departmentName);
            payload.put("positionCode", positionCode);
            payload.put("positionName", positionName);
            payload.put("workingConditionCode", workingConditionCode);
            payload.put("workingConditionName", workingConditionName);
            payload.put("employmentStatus", HrEmploymentStatus.ACTIVE.name());
            payload.put("hireDate", hireDate);
            payload.put("leaveDays", leaveDays);
            payload.put("inclusionReason", inclusionReason.name());
            return payload;
        }
    }
}

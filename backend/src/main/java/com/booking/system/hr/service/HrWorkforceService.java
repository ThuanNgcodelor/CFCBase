package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrMovementCreateRequest;
import com.booking.system.hr.api.dto.HrMovementResponse;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeMovement;
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
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final EntityManager entityManager;

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
        if (movement.getEffectiveDate().isAfter(today())) {
            throw HrApiException.badRequest("MOVEMENT_EFFECTIVE_DATE_IN_FUTURE",
                    "Chưa thể xác nhận biến động trước ngày hiệu lực.");
        }

        HrEmployee employee = lockedEmployee(movement.getEmployee().getId());
        HrEmployeeEmployment employment = employee.getEmployment();
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

        LocalDateTime now = nowUtc();
        touch(employee, actor);
        movement.setStatus(HrMovementStatus.CONFIRMED);
        movement.setConfirmedAt(now);
        movement.setConfirmedByActor(displayActor(actor));
        touch(movement, actor);
        movementRepository.save(movement);
        audit(actor, "HR_MOVEMENT_CONFIRMED", "HR_EMPLOYEE_MOVEMENT", movement.getId(),
                List.of("status", "confirmedAt", "employeeStatus"),
                Map.of("movementType", movement.getMovementType().name(), "employeeId", employee.getId()));
        entityManager.flush();
        return HrMovementResponse.from(movement);
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
                || importRowRepository.countByEmployee_Id(employeeId) > 0) {
            throw HrApiException.conflict("EMPLOYEE_HAS_REFERENCES",
                    "Hồ sơ đã có biến động, snapshot hoặc dữ liệu import tham chiếu.");
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
        List<HrEmployeeMovement> movements = movementRepository.findConfirmedForSnapshot(
                HrMovementStatus.CONFIRMED,
                SNAPSHOT_MOVEMENT_TYPES,
                periodEnd
        );
        for (HrEmployeeMovement movement : movements) {
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
        int displayOrder = 1;
        for (SnapshotDraft draft : snapshots.values()) {
            Map<String, Object> payload = draft.payload(displayOrder);
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
            item.setLeaveDays(draft.leaveDays());
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

        Map<String, Object> payload(int displayOrder) {
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

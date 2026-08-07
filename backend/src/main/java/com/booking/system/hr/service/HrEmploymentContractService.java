package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmploymentContract;
import com.booking.system.hr.entity.HrProbationCandidate;
import com.booking.system.hr.enums.HrEmploymentContractStatus;
import com.booking.system.hr.enums.HrEmploymentContractType;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeEmploymentRepository;
import com.booking.system.hr.repository.HrEmploymentContractRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class HrEmploymentContractService {

    private static final EnumSet<HrEmploymentContractStatus> CURRENT_STATUSES = EnumSet.of(
            HrEmploymentContractStatus.READY,
            HrEmploymentContractStatus.EFFECTIVE
    );

    private final HrEmploymentContractRepository contractRepository;
    private final HrEmployeeEmploymentRepository employmentRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public HrApiDtos.EmploymentContractSummary currentContract(String employeeId) {
        return currentEntity(employeeId, false).map(this::toSummary).orElse(null);
    }

    @Transactional(readOnly = true)
    public Optional<HrEmploymentContract> findByIdempotencyKey(String idempotencyKey) {
        String safeKey = trimToNull(idempotencyKey);
        return safeKey == null ? Optional.empty() : contractRepository.findByIdempotencyKey(safeKey);
    }

    public boolean matchesInput(
            HrEmploymentContract existing,
            HrApiDtos.EmploymentContractInput input
    ) {
        if (existing == null || input == null) {
            return false;
        }
        return existing.getContractType() == input.contractType()
                && Objects.equals(existing.getContractNumber(), trimToNull(input.contractNumber()))
                && Objects.equals(existing.getSignDate(), input.signDate())
                && Objects.equals(existing.getEffectiveFrom(), input.effectiveFrom())
                && Objects.equals(existing.getEffectiveUntil(), input.effectiveUntil());
    }

    @Transactional
    public HrEmploymentContract createReadyContract(
            HrEmployee employee,
            HrProbationCandidate sourceCandidate,
            HrApiDtos.EmploymentContractInput input,
            String idempotencyKey,
            HrImportActor actor
    ) {
        String safeKey = requiredText(idempotencyKey, "Khóa chống trùng onboarding là bắt buộc.");
        String contractNumber = requiredText(input.contractNumber(), "Số hợp đồng lao động là bắt buộc.");
        validate(input);

        HrEmploymentContract replay = contractRepository.findByIdempotencyKey(safeKey).orElse(null);
        if (replay != null) {
            if (sameRequest(replay, employee, sourceCandidate, input, contractNumber)) {
                return replay;
            }
            throw HrApiException.conflict("ONBOARDING_IDEMPOTENCY_CONFLICT",
                    "Khóa chống trùng đã được dùng cho một hồ sơ onboarding khác.");
        }
        if (contractRepository.existsByContractNumber(contractNumber)) {
            throw HrApiException.conflict("EMPLOYMENT_CONTRACT_NUMBER_EXISTS",
                    "Số hợp đồng lao động đã tồn tại.");
        }
        if (currentEntity(employee.getId(), true).isPresent()) {
            throw HrApiException.conflict("EMPLOYEE_CURRENT_CONTRACT_EXISTS",
                    "Nhân sự đã có hợp đồng lao động hiện hành hoặc đang chờ hiệu lực.");
        }

        HrEmploymentContract contract = new HrEmploymentContract();
        contract.setEmployee(employee);
        contract.setSourceProbationCandidate(sourceCandidate);
        contract.setContractType(input.contractType());
        contract.setContractNumber(contractNumber);
        contract.setSignDate(input.signDate());
        contract.setEffectiveFrom(input.effectiveFrom());
        contract.setEffectiveUntil(input.effectiveUntil());
        contract.setStatus(HrEmploymentContractStatus.READY);
        contract.setIdempotencyKey(safeKey);
        setCreatedAudit(contract, actor);
        contract = contractRepository.save(contract);

        updateEmploymentProjection(employee.getEmployment(), contract, actor);
        audit(actor, "HR_EMPLOYMENT_CONTRACT_READY", "HR_EMPLOYMENT_CONTRACT", contract.getId(),
                List.of("contractType", "contractNumber", "signDate", "effectiveFrom", "effectiveUntil", "status"),
                Map.of(
                        "employeeId", employee.getId(),
                        "contractType", contract.getContractType().name(),
                        "status", contract.getStatus().name()
                ));
        entityManager.flush();
        return contract;
    }

    @Transactional
    public HrEmploymentContract requireReadyForIncrease(HrEmployee employee, LocalDate effectiveDate) {
        if (employee.getOnboardingPolicyVersion() < 2) {
            return null;
        }
        HrEmploymentContract contract = currentEntity(employee.getId(), true)
                .orElseThrow(() -> HrApiException.conflict("EMPLOYMENT_CONTRACT_REQUIRED",
                        "Hồ sơ onboarding mới phải có thông tin hợp đồng trước khi tăng nhân sự."));
        if (contract.getStatus() != HrEmploymentContractStatus.READY
                && contract.getStatus() != HrEmploymentContractStatus.EFFECTIVE) {
            throw HrApiException.conflict("EMPLOYMENT_CONTRACT_NOT_READY",
                    "Hợp đồng lao động chưa sẵn sàng để tăng nhân sự.");
        }
        if (!Objects.equals(contract.getEffectiveFrom(), effectiveDate)) {
            throw HrApiException.badRequest("MOVEMENT_CONTRACT_DATE_MISMATCH",
                    "Ngày hiệu lực tăng nhân sự phải trùng ngày bắt đầu hợp đồng.");
        }
        return contract;
    }

    @Transactional
    public void markEffective(HrEmploymentContract contract, HrImportActor actor) {
        if (contract == null || contract.getStatus() == HrEmploymentContractStatus.EFFECTIVE) {
            return;
        }
        if (contract.getStatus() != HrEmploymentContractStatus.READY) {
            throw HrApiException.conflict("EMPLOYMENT_CONTRACT_NOT_READY",
                    "Chỉ hợp đồng đã sẵn sàng mới có thể chuyển sang hiệu lực.");
        }
        contract.setStatus(HrEmploymentContractStatus.EFFECTIVE);
        contract.setActivatedAt(LocalDateTime.now(ZoneOffset.UTC));
        contract.setActivatedByActor(actor.subject());
        touch(contract, actor);
        contractRepository.save(contract);
        audit(actor, "HR_EMPLOYMENT_CONTRACT_EFFECTIVE", "HR_EMPLOYMENT_CONTRACT", contract.getId(),
                List.of("status", "activatedAt"),
                Map.of("employeeId", contract.getEmployee().getId(), "status", contract.getStatus().name()));
    }

    public HrApiDtos.EmploymentContractSummary toSummary(HrEmploymentContract contract) {
        return new HrApiDtos.EmploymentContractSummary(
                contract.getId(),
                contract.getContractType(),
                contract.getContractNumber(),
                contract.getSignDate(),
                contract.getEffectiveFrom(),
                contract.getEffectiveUntil(),
                contract.getStatus(),
                contract.getRowVersion()
        );
    }

    private Optional<HrEmploymentContract> currentEntity(String employeeId, boolean forUpdate) {
        List<HrEmploymentContract> contracts = forUpdate
                ? contractRepository.findCurrentForUpdate(employeeId, CURRENT_STATUSES, PageRequest.of(0, 1))
                : contractRepository.findCurrent(employeeId, CURRENT_STATUSES, PageRequest.of(0, 1));
        return contracts.stream().findFirst();
    }

    private static void validate(HrApiDtos.EmploymentContractInput input) {
        if (input == null || input.contractType() == null || input.signDate() == null || input.effectiveFrom() == null) {
            throw HrApiException.badRequest("EMPLOYMENT_CONTRACT_REQUIRED_FIELDS",
                    "Loại, ngày ký và ngày hiệu lực hợp đồng là bắt buộc.");
        }
        if (input.contractType() == HrEmploymentContractType.FIXED_TERM_12_MONTHS) {
            LocalDate expectedEnd = input.effectiveFrom().plusYears(1);
            if (!Objects.equals(input.effectiveUntil(), expectedEnd)) {
                throw HrApiException.badRequest("EMPLOYMENT_CONTRACT_12_MONTH_END_INVALID",
                        "Hợp đồng 12 tháng phải kết thúc đúng một năm sau ngày hiệu lực.");
            }
        } else if (input.effectiveUntil() != null) {
            throw HrApiException.badRequest("INDEFINITE_CONTRACT_END_DATE_NOT_ALLOWED",
                    "Hợp đồng không xác định thời hạn không có ngày kết thúc.");
        }
    }

    private boolean sameRequest(
            HrEmploymentContract existing,
            HrEmployee employee,
            HrProbationCandidate sourceCandidate,
            HrApiDtos.EmploymentContractInput input,
            String contractNumber
    ) {
        return Objects.equals(existing.getEmployee().getId(), employee.getId())
                && Objects.equals(id(existing.getSourceProbationCandidate()), id(sourceCandidate))
                && Objects.equals(contractNumber, trimToNull(input.contractNumber()))
                && matchesInput(existing, input);
    }

    private void updateEmploymentProjection(
            HrEmployeeEmployment employment,
            HrEmploymentContract contract,
            HrImportActor actor
    ) {
        if (employment == null) {
            return;
        }
        employment.setContractTypeLabel(contract.getContractType() == HrEmploymentContractType.INDEFINITE
                ? "Hợp đồng không xác định thời hạn"
                : "Hợp đồng xác định thời hạn 12 tháng");
        employment.setContractNumber(contract.getContractNumber());
        touch(employment, actor);
        employmentRepository.save(employment);
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
            throw new IllegalStateException("Không thể ghi audit hợp đồng lao động.", exception);
        }
        auditRepository.save(event);
    }

    private static String requiredText(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw HrApiException.badRequest("REQUIRED_VALUE", message);
        }
        return normalized;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String id(HrProbationCandidate candidate) {
        return candidate == null ? null : candidate.getId();
    }

    private static void setCreatedAudit(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private static void touch(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setUpdatedByActor(actor.subject());
        entity.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
    }
}

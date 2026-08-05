package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrLeaveEntitlementResponse;
import com.booking.system.hr.api.dto.HrLeaveEntitlementUpdateRequest;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeLeaveEntitlement;
import com.booking.system.hr.entity.HrWorkingCondition;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrEmployeeLeaveEntitlementRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HrLeaveEntitlementService {

    private static final BigDecimal DEFAULT_BASE_DAYS = new BigDecimal("12.00");

    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeLeaveEntitlementRepository leaveEntitlementRepository;

    @Transactional(readOnly = true)
    public HrLeaveEntitlementResponse entitlement(String employeeId, int leaveYear) {
        short year = requireLeaveYear(leaveYear);
        HrEmployee employee = requireEmployee(employeeId);
        Optional<HrEmployeeLeaveEntitlement> override =
                leaveEntitlementRepository.findByEmployee_IdAndLeaveYear(employeeId, year);
        return toResponse(employee, year, override.orElse(null));
    }

    @Transactional
    public HrLeaveEntitlementResponse updateEntitlement(
            String employeeId,
            HrLeaveEntitlementUpdateRequest request,
            HrImportActor actor
    ) {
        short leaveYear = requireLeaveYear(request.leaveYear());
        HrEmployee employee = requireEmployee(employeeId);
        HrEmployeeLeaveEntitlement entitlement = leaveEntitlementRepository
                .findByEmployee_IdAndLeaveYear(employeeId, leaveYear)
                .orElse(null);
        long actualVersion = entitlement == null ? 0L : entitlement.getRowVersion();
        if (actualVersion != request.rowVersion()) {
            throw HrApiException.conflict("STALE_LEAVE_ENTITLEMENT_VERSION",
                    "Số ngày nghỉ phép đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        }
        if (entitlement == null) {
            entitlement = new HrEmployeeLeaveEntitlement();
            entitlement.setEmployee(employee);
            entitlement.setLeaveYear(leaveYear);
            setCreatedAudit(entitlement, actor);
        } else {
            touch(entitlement, actor);
        }
        entitlement.setManualOverrideDays(request.manualOverrideDays());
        entitlement.setNote(trimToNull(request.note()));
        leaveEntitlementRepository.save(entitlement);
        return toResponse(employee, leaveYear, entitlement);
    }

    @Transactional(readOnly = true)
    public Map<String, LeaveEntitlementSnapshot> resolveForEmployees(Collection<HrEmployee> employees, int leaveYear) {
        if (employees == null || employees.isEmpty()) {
            return Map.of();
        }
        short year = requireLeaveYear(leaveYear);
        List<HrEmployee> resolvedEmployees = employees.stream()
                .filter(employee -> employee != null && employee.getId() != null && !employee.getId().isBlank())
                .toList();
        if (resolvedEmployees.isEmpty()) {
            return Map.of();
        }
        List<String> employeeIds = resolvedEmployees.stream().map(HrEmployee::getId).toList();
        Map<String, HrEmployeeLeaveEntitlement> overrides = leaveEntitlementRepository
                .findAllByEmployee_IdInAndLeaveYear(employeeIds, year)
                .stream()
                .collect(Collectors.toMap(item -> item.getEmployee().getId(), item -> item));

        Map<String, LeaveEntitlementSnapshot> result = new LinkedHashMap<>();
        for (HrEmployee employee : resolvedEmployees) {
            result.put(employee.getId(), snapshot(employee, year, overrides.get(employee.getId())));
        }
        return result;
    }

    private HrEmployee requireEmployee(String employeeId) {
        return employeeRepository.findDetailById(requiredText(employeeId, "Mã nhân sự là bắt buộc."))
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy hồ sơ nhân sự."));
    }

    private HrLeaveEntitlementResponse toResponse(HrEmployee employee, short leaveYear, HrEmployeeLeaveEntitlement override) {
        LeaveEntitlementSnapshot snapshot = snapshot(employee, leaveYear, override);
        return new HrLeaveEntitlementResponse(
                override == null ? null : override.getId(),
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getFullName(),
                leaveYear,
                snapshot.workingConditionName(),
                snapshot.leaveAccrualStartDate(),
                snapshot.baseDays(),
                snapshot.seniorityBonusDays(),
                snapshot.calculatedDays(),
                snapshot.manualOverrideDays(),
                snapshot.finalDays(),
                snapshot.note(),
                override == null ? 0L : override.getRowVersion(),
                override == null ? null : override.getUpdatedAt()
        );
    }

    private LeaveEntitlementSnapshot snapshot(HrEmployee employee, short leaveYear, HrEmployeeLeaveEntitlement override) {
        HrEmployeeEmployment employment = employee.getEmployment();
        BigDecimal baseDays = resolveBaseDays(employment == null ? null : employment.getWorkingCondition());
        BigDecimal seniorityBonusDays = BigDecimal.valueOf(resolveSeniorityBonus(employment, leaveYear));
        BigDecimal calculatedDays = baseDays.add(seniorityBonusDays);
        BigDecimal manualOverrideDays = override == null ? null : override.getManualOverrideDays();
        BigDecimal finalDays = manualOverrideDays == null ? calculatedDays : manualOverrideDays;
        return new LeaveEntitlementSnapshot(
                baseDays,
                seniorityBonusDays,
                calculatedDays,
                manualOverrideDays,
                finalDays,
                override == null ? null : override.getNote(),
                employment == null || employment.getWorkingCondition() == null
                        ? null
                        : employment.getWorkingCondition().getName(),
                employment == null ? null : firstDate(employment.getLeaveAccrualStartDate(), employment.getHireDate())
        );
    }

    private static BigDecimal resolveBaseDays(HrWorkingCondition workingCondition) {
        if (workingCondition == null || workingCondition.getAnnualLeaveDaysBase() == null) {
            return DEFAULT_BASE_DAYS;
        }
        return workingCondition.getAnnualLeaveDaysBase();
    }

    private static long resolveSeniorityBonus(HrEmployeeEmployment employment, short leaveYear) {
        if (employment == null) {
            return 0L;
        }
        LocalDate accrualStartDate = firstDate(employment.getLeaveAccrualStartDate(), employment.getHireDate());
        if (accrualStartDate == null) {
            return 0L;
        }
        LocalDate yearEnd = LocalDate.of(leaveYear, 12, 31);
        if (accrualStartDate.isAfter(yearEnd)) {
            return 0L;
        }
        long fullYears = ChronoUnit.YEARS.between(accrualStartDate, yearEnd);
        return Math.max(0L, fullYears / 5L);
    }

    private static short requireLeaveYear(int leaveYear) {
        if (leaveYear < 2000 || leaveYear > 2100) {
            throw HrApiException.badRequest("LEAVE_YEAR_INVALID", "Năm nghỉ phép không hợp lệ.");
        }
        return (short) leaveYear;
    }

    private static LocalDate firstDate(LocalDate primary, LocalDate fallback) {
        return primary != null ? primary : fallback;
    }

    private static void setCreatedAudit(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private static void touch(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setUpdatedByActor(actor.subject());
        entity.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
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

    public record LeaveEntitlementSnapshot(
            BigDecimal baseDays,
            BigDecimal seniorityBonusDays,
            BigDecimal calculatedDays,
            BigDecimal manualOverrideDays,
            BigDecimal finalDays,
            String note,
            String workingConditionName,
            LocalDate leaveAccrualStartDate
    ) {
    }
}

package com.booking.system.hr.service;

import com.booking.system.hr.api.dto.HrLeaveSyncItemResponse;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HrLeaveSyncService {

    private final HrRosterProjectionService rosterProjectionService;
    private final HrEmployeeMovementRepository movementRepository;

    public List<HrLeaveSyncItemResponse> getLeaveSyncRoster(String requestedPeriod, boolean activeOnly) {
        LocalDate periodStart = parseOrCurrentPeriod(requestedPeriod);
        String periodKey = monthSheetName(periodStart);
        LocalDate asOfDate = periodStart.with(TemporalAdjusters.lastDayOfMonth());

        // 1. Lấy danh sách nhân sự đang hoạt động chính xác từ Roster Projection (334 người)
        List<HrRosterProjectionService.ProjectedRosterItem> activeItems = rosterProjectionService.projectedItems(periodStart);

        List<HrLeaveSyncItemResponse> result = new ArrayList<>();
        Set<String> processedEmployeeCodes = new HashSet<>();

        for (HrRosterProjectionService.ProjectedRosterItem item : activeItems) {
            String serviceYears = tenureLabel(item.hireDate(), asOfDate);
            result.add(new HrLeaveSyncItemResponse(
                    item.employeeCode(),
                    item.fullName(),
                    item.departmentName() != null ? item.departmentName() : "",
                    item.positionName() != null ? item.positionName() : "",
                    item.hireDate(),
                    item.workingConditionName() != null ? item.workingConditionName() : "Bình Thường",
                    serviceYears,
                    item.leaveDays() != null ? item.leaveDays() : BigDecimal.valueOf(12),
                    HrEmploymentStatus.ACTIVE,
                    item.terminationDate(),
                    periodKey
            ));
            processedEmployeeCodes.add(item.employeeCode());
        }

        // 2. Nếu !activeOnly, bổ sung các nhân sự đã nghỉ việc / giảm nhân sự để Google Apps Script nhận diện và khóa
        if (!activeOnly) {
            List<HrEmployeeMovement> decreaseMovements = movementRepository.findConfirmedForProjection(
                    HrMovementStatus.CONFIRMED,
                    EnumSet.of(HrMovementType.DECREASE)
            );

            for (HrEmployeeMovement movement : decreaseMovements) {
                HrEmployee employee = movement.getEmployee();
                if (employee == null || employee.getEmployeeCode() == null) {
                    continue;
                }
                if (processedEmployeeCodes.contains(employee.getEmployeeCode())) {
                    continue;
                }
                HrEmployeeEmployment employment = employee.getEmployment();
                LocalDate hireDate = employment != null ? employment.getHireDate() : null;
                LocalDate termDate = movement.getEffectiveDate();
                String serviceYears = tenureLabel(hireDate, termDate != null ? termDate : asOfDate);

                result.add(new HrLeaveSyncItemResponse(
                        employee.getEmployeeCode(),
                        employee.getFullName(),
                        employment != null && employment.getDepartment() != null ? employment.getDepartment().getName() : "",
                        employment != null && employment.getPosition() != null ? employment.getPosition().getName() : "",
                        hireDate,
                        employment != null && employment.getWorkingCondition() != null ? employment.getWorkingCondition().getName() : "Bình Thường",
                        serviceYears,
                        BigDecimal.ZERO,
                        HrEmploymentStatus.INACTIVE,
                        termDate,
                        periodKey
                ));
                processedEmployeeCodes.add(employee.getEmployeeCode());
            }
        }

        return result;
    }

    private static String tenureLabel(LocalDate startDate, LocalDate asOf) {
        if (startDate == null || asOf == null || startDate.isAfter(asOf)) {
            return "";
        }
        int years = 0;
        LocalDate cursor = startDate;
        while (!cursor.plusYears(1).isAfter(asOf)) {
            cursor = cursor.plusYears(1);
            years++;
        }
        int months = 0;
        while (!cursor.plusMonths(1).isAfter(asOf)) {
            cursor = cursor.plusMonths(1);
            months++;
        }
        long days = ChronoUnit.DAYS.between(cursor, asOf) + 1;
        return years + " NĂM " + months + " THÁNG " + days + " NGÀY ";
    }

    private static LocalDate parseOrCurrentPeriod(String period) {
        if (period == null || period.isBlank()) {
            LocalDate now = LocalDate.now();
            return LocalDate.of(now.getYear(), now.getMonthValue(), 1);
        }
        String p = period.trim().toUpperCase();
        if (p.startsWith("T")) {
            String[] parts = p.substring(1).split("-");
            if (parts.length == 2) {
                try {
                    int month = Integer.parseInt(parts[0]);
                    int year = Integer.parseInt(parts[1]);
                    if (year < 100) year += 2000;
                    return LocalDate.of(year, month, 1);
                } catch (NumberFormatException ignored) {
                }
            }
        }
        try {
            LocalDate d = LocalDate.parse(p);
            return LocalDate.of(d.getYear(), d.getMonthValue(), 1);
        } catch (Exception ignored) {
        }

        LocalDate now = LocalDate.now();
        return LocalDate.of(now.getYear(), now.getMonthValue(), 1);
    }

    private static String monthSheetName(LocalDate periodStart) {
        return "T" + periodStart.getMonthValue() + "-" + String.valueOf(periodStart.getYear()).substring(2);
    }
}

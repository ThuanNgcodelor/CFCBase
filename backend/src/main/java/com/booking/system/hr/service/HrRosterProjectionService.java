package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.HrActivityQueryService;
import com.booking.system.hr.api.dto.HrMovementImpactPreviewResponse;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrRosterReconciliationResponse;
import com.booking.system.hr.api.dto.HrRosterItemResponse;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.entity.HrMonthlyRosterItem;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.enums.HrRosterInclusionReason;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HrRosterProjectionService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern PERIOD_ID = Pattern.compile("^period-\\d{4}-\\d{2}-\\d{2}$");
    private static final EnumSet<HrMovementType> LIVE_MOVEMENT_TYPES = EnumSet.of(
            HrMovementType.INCREASE,
            HrMovementType.DECREASE,
            HrMovementType.REHIRE
    );

    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final HrEmployeeMovementRepository movementRepository;

    public HrPageResponse<HrRosterResponse> rosters(int page, int size) {
        Optional<HrMonthlyRoster> baseline = baselineRoster();
        if (baseline.isEmpty()) {
            return emptyPage(page, safeSize(size));
        }

        LocalDate firstPeriod = baseline.get().getPeriodStart();
        LocalDate lastPeriod = currentPeriod();
        if (lastPeriod.isBefore(firstPeriod)) {
            lastPeriod = firstPeriod;
        }

        List<LocalDate> periods = descendingPeriods(firstPeriod, lastPeriod);
        int safePage = Math.max(0, page);
        int safeSize = safeSize(size);
        int fromIndex = Math.min(safePage * safeSize, periods.size());
        int toIndex = Math.min(fromIndex + safeSize, periods.size());
        Map<LocalDate, HrMonthlyRoster> storedRosters = storedRosters(firstPeriod, lastPeriod);
        List<HrEmployeeMovement> timeline = confirmedProjectionMovements();
        List<HrRosterResponse> content = periods.subList(fromIndex, toIndex).stream()
                .map(period -> rosterResponse(period, storedRosters.get(period), baseline.get(), timeline))
                .toList();

        return pageResponse(content, safePage, safeSize, periods.size());
    }

    public HrRosterResponse roster(String rosterIdOrPeriod) {
        ResolvedRoster resolved = resolveRoster(rosterIdOrPeriod);
        return rosterResponse(
                resolved.periodStart(),
                resolved.storedRoster().orElse(null),
                resolved.baseline(),
                confirmedProjectionMovements()
        );
    }

    public HrPageResponse<HrRosterItemResponse> rosterItems(String rosterIdOrPeriod, int page, int size) {
        LocalDate periodStart = resolveRoster(rosterIdOrPeriod).periodStart();
        List<ProjectedRosterItem> items = projectedItems(periodStart, null, confirmedProjectionMovements());
        int safePage = Math.max(0, page);
        int safeSize = safeSize(size);
        int fromIndex = Math.min(safePage * safeSize, items.size());
        int toIndex = Math.min(fromIndex + safeSize, items.size());
        List<HrRosterItemResponse> content = items.subList(fromIndex, toIndex).stream()
                .map(HrRosterItemResponse::fromProjection)
                .toList();
        return pageResponse(content, safePage, safeSize, items.size());
    }

    public List<ProjectedRosterItem> projectedItems(LocalDate periodStart) {
        return projectedItems(periodStart, null, confirmedProjectionMovements());
    }

    public HrMovementImpactPreviewResponse previewMovement(HrEmployeeMovement draftMovement) {
        if (draftMovement == null || draftMovement.getEffectiveDate() == null) {
            throw HrApiException.badRequest("MOVEMENT_PREVIEW_INVALID", "Biến động nháp không hợp lệ để xem trước.");
        }
        HrMonthlyRoster baseline = baselineRoster().orElseThrow(() -> HrApiException.notFound(
                "HR_ROSTER_NOT_FOUND", "Cần có dữ liệu nền T6 trước khi xem ảnh hưởng."));
        LocalDate affectedFrom = draftMovement.getEffectiveDate().withDayOfMonth(1);
        if (draftMovement.getCorrectionOfMovement() != null) {
            LocalDate originalPeriod = draftMovement.getCorrectionOfMovement().getEffectiveDate().withDayOfMonth(1);
            if (originalPeriod.isBefore(affectedFrom)) {
                affectedFrom = originalPeriod;
            }
        }
        affectedFrom = affectedFrom.isBefore(baseline.getPeriodStart())
                ? baseline.getPeriodStart()
                : affectedFrom;
        LocalDate affectedTo = currentPeriod();
        if (affectedTo.isBefore(affectedFrom)) {
            affectedTo = affectedFrom;
        }

        List<HrEmployeeMovement> timeline = confirmedProjectionMovements();
        List<HrMovementImpactPreviewResponse.PeriodImpact> periods = new ArrayList<>();
        for (LocalDate period = affectedFrom; !period.isAfter(affectedTo); period = period.plusMonths(1)) {
            int before = projectedItems(period, null, timeline).size();
            int after = projectedItems(period, draftMovement, timeline).size();
            periods.add(new HrMovementImpactPreviewResponse.PeriodImpact(period, before, after, after - before));
        }
        return new HrMovementImpactPreviewResponse(
                draftMovement.getId(),
                draftMovement.getEmployee().getFullName(),
                draftMovement.getMovementType(),
                draftMovement.getEffectiveDate(),
                affectedFrom,
                affectedTo,
                List.copyOf(periods)
        );
    }

    public HrRosterReconciliationResponse reconciliation() {
        HrMonthlyRoster baseline = baselineRoster().orElseThrow(() -> HrApiException.notFound(
                "HR_ROSTER_NOT_FOUND", "Chưa có dữ liệu nền để đối soát."));
        LocalDate current = currentPeriod();
        if (current.isBefore(baseline.getPeriodStart())) {
            current = baseline.getPeriodStart();
        }

        List<HrEmployeeMovement> timeline = confirmedProjectionMovements();
        Set<String> supersededIds = supersededMovementIds(timeline);
        List<HrRosterReconciliationResponse.PeriodSummary> periods = new ArrayList<>();
        for (LocalDate period = baseline.getPeriodStart(); !period.isAfter(current); period = period.plusMonths(1)) {
            LocalDate periodEnd = period.with(TemporalAdjusters.lastDayOfMonth());
            int applied = (int) timeline.stream()
                    .filter(movement -> !supersededIds.contains(movement.getId()))
                    .filter(movement -> !movement.getEffectiveDate().isAfter(periodEnd))
                    .count();
            int adjustments = (int) timeline.stream()
                    .filter(movement -> movement.getCorrectionOfMovement() != null)
                    .filter(movement -> !movement.getEffectiveDate().isAfter(periodEnd))
                    .count();
            periods.add(new HrRosterReconciliationResponse.PeriodSummary(
                    period,
                    projectedItems(period, null, timeline).size(),
                    applied,
                    adjustments
            ));
        }
        int baselineSnapshotHeadcount = rosterItemRepository
                .findAllByRoster_IdOrderByDisplayOrder(baseline.getId())
                .size();
        int currentHeadcount = periods.isEmpty() ? 0 : periods.getLast().headcount();
        int confirmedAdjustments = (int) timeline.stream()
                .filter(movement -> movement.getCorrectionOfMovement() != null)
                .count();
        return new HrRosterReconciliationResponse(
                baseline.getPeriodStart(),
                baselineSnapshotHeadcount,
                current,
                currentHeadcount,
                timeline.size(),
                confirmedAdjustments,
                List.copyOf(periods)
        );
    }

    private List<ProjectedRosterItem> projectedItems(
            LocalDate periodStart,
            HrEmployeeMovement candidate,
            List<HrEmployeeMovement> confirmedTimeline
    ) {
        LocalDate normalizedPeriod = requirePeriodStart(periodStart);
        Optional<HrMonthlyRoster> baseline = baselineRoster();
        if (baseline.isEmpty()
                || normalizedPeriod.isBefore(baseline.get().getPeriodStart())
                || normalizedPeriod.isAfter(currentPeriod())) {
            return List.of();
        }

        LinkedHashMap<String, RosterItemDraft> drafts = new LinkedHashMap<>();
        for (HrMonthlyRosterItem item : rosterItemRepository
                .findAllByRoster_IdOrderByDisplayOrder(baseline.get().getId())) {
            drafts.put(item.getEmployee().getId(), RosterItemDraft.fromBaseline(item));
        }

        LocalDate periodEnd = normalizedPeriod.with(TemporalAdjusters.lastDayOfMonth());
        List<HrEmployeeMovement> movements = new ArrayList<>(confirmedTimeline);
        if (candidate != null) {
            movements.add(candidate);
        }
        Set<String> supersededIds = supersededMovementIds(movements);
        for (HrEmployeeMovement movement : movements) {
            if (supersededIds.contains(movement.getId()) || movement.getEffectiveDate().isAfter(periodEnd)) {
                continue;
            }
            String employeeId = movement.getEmployee().getId();
            if (movement.getMovementType() == HrMovementType.DECREASE) {
                drafts.remove(employeeId);
            } else if (!drafts.containsKey(employeeId)) {
                drafts.put(employeeId, RosterItemDraft.fromMovement(movement));
            }
        }

        List<ProjectedRosterItem> projected = new ArrayList<>(drafts.size());
        int displayOrder = 1;
        for (RosterItemDraft draft : drafts.values()) {
            projected.add(draft.toProjected(periodKey(normalizedPeriod), displayOrder++));
        }
        return projected;
    }

    private List<HrEmployeeMovement> confirmedProjectionMovements() {
        return movementRepository.findConfirmedForProjection(HrMovementStatus.CONFIRMED, LIVE_MOVEMENT_TYPES);
    }

    private static Set<String> supersededMovementIds(List<HrEmployeeMovement> movements) {
        Set<String> ids = new HashSet<>();
        for (HrEmployeeMovement movement : movements) {
            if (movement.getCorrectionOfMovement() != null) {
                ids.add(movement.getCorrectionOfMovement().getId());
            }
        }
        return ids;
    }

    private HrRosterResponse rosterResponse(
            LocalDate periodStart,
            HrMonthlyRoster storedRoster,
            HrMonthlyRoster baseline,
            List<HrEmployeeMovement> timeline
    ) {
        int itemCount = projectedItems(periodStart, null, timeline).size();
        boolean baselinePeriod = baseline.getPeriodStart().equals(periodStart);
        return new HrRosterResponse(
                storedRoster == null ? periodKey(periodStart) : storedRoster.getId(),
                periodStart,
                HrRosterStatus.OPEN,
                itemCount,
                null,
                null,
                baselinePeriod,
                null,
                storedRoster == null ? null : storedRoster.getOpenedAt(),
                storedRoster == null ? null : storedRoster.getOpenedByActor(),
                null,
                null,
                storedRoster == null ? null : storedRoster.getExportedAt(),
                storedRoster == null ? null : storedRoster.getExportedByActor(),
                storedRoster == null ? null : storedRoster.getCreatedAt(),
                storedRoster == null ? null : storedRoster.getCreatedByActor(),
                storedRoster == null ? 0L : storedRoster.getRowVersion()
        );
    }

    private ResolvedRoster resolveRoster(String rosterIdOrPeriod) {
        if (rosterIdOrPeriod == null || rosterIdOrPeriod.isBlank()) {
            throw HrApiException.notFound("HR_ROSTER_NOT_FOUND", "Không tìm thấy danh sách nhân sự tháng.");
        }
        HrMonthlyRoster baseline = baselineRoster()
                .orElseThrow(() -> HrApiException.notFound(
                        "HR_ROSTER_NOT_FOUND", "Không tìm thấy danh sách nhân sự tháng."));

        if (PERIOD_ID.matcher(rosterIdOrPeriod).matches()) {
            LocalDate periodStart = requirePeriodStart(LocalDate.parse(rosterIdOrPeriod.substring("period-".length())));
            if (periodStart.isBefore(baseline.getPeriodStart())) {
                throw HrApiException.notFound("HR_ROSTER_NOT_FOUND", "Không tìm thấy danh sách nhân sự tháng.");
            }
            return new ResolvedRoster(periodStart, Optional.empty(), baseline);
        }

        HrMonthlyRoster storedRoster = rosterRepository.findById(rosterIdOrPeriod)
                .orElseThrow(() -> HrApiException.notFound(
                        "HR_ROSTER_NOT_FOUND", "Không tìm thấy danh sách nhân sự tháng."));
        return new ResolvedRoster(storedRoster.getPeriodStart(), Optional.of(storedRoster), baseline);
    }

    private Optional<HrMonthlyRoster> baselineRoster() {
        return rosterRepository.findFirstByOrderByPeriodStartAsc();
    }

    private Map<LocalDate, HrMonthlyRoster> storedRosters(LocalDate from, LocalDate to) {
        Map<LocalDate, HrMonthlyRoster> rosters = new LinkedHashMap<>();
        for (HrMonthlyRoster roster : rosterRepository.findAllByPeriodStartBetweenOrderByPeriodStartAsc(from, to)) {
            rosters.put(roster.getPeriodStart(), roster);
        }
        return rosters;
    }

    private static List<LocalDate> descendingPeriods(LocalDate from, LocalDate to) {
        int months = (int) ChronoUnit.MONTHS.between(from, to) + 1;
        List<LocalDate> periods = new ArrayList<>(Math.max(0, months));
        for (int index = 0; index < months; index++) {
            periods.add(to.minusMonths(index));
        }
        return periods;
    }

    private static LocalDate requirePeriodStart(LocalDate value) {
        if (value == null || value.getDayOfMonth() != 1) {
            throw HrApiException.badRequest("ROSTER_PERIOD_INVALID",
                    "Kỳ nhân sự phải là ngày đầu tiên của tháng.");
        }
        return value;
    }

    private static LocalDate currentPeriod() {
        return LocalDate.now(BUSINESS_ZONE).withDayOfMonth(1);
    }

    private static String periodKey(LocalDate periodStart) {
        return "period-" + periodStart;
    }

    private static int safeSize(int size) {
        return size <= 0 ? HrActivityQueryService.DEFAULT_PAGE_SIZE : Math.min(size, HrActivityQueryService.MAX_PAGE_SIZE);
    }

    private static <T> HrPageResponse<T> emptyPage(int page, int size) {
        return pageResponse(List.of(), Math.max(0, page), safeSize(size), 0);
    }

    private static <T> HrPageResponse<T> pageResponse(List<T> content, int page, int size, long totalElements) {
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new HrPageResponse<>(
                content,
                page,
                size,
                totalElements,
                totalPages,
                page == 0,
                totalPages == 0 || page >= totalPages - 1
        );
    }

    private static String code(HrCatalogEntity catalog) {
        return catalog == null ? null : catalog.getCode();
    }

    private static String name(HrCatalogEntity catalog) {
        return catalog == null ? null : catalog.getName();
    }

    private record ResolvedRoster(
            LocalDate periodStart,
            Optional<HrMonthlyRoster> storedRoster,
            HrMonthlyRoster baseline
    ) {
    }

    private record RosterItemDraft(
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
            HrEmployeeMovement sourceMovement,
            LocalDateTime createdAt,
            String createdByActor
    ) {
        static RosterItemDraft fromBaseline(HrMonthlyRosterItem item) {
            return new RosterItemDraft(
                    item.getEmployee(),
                    item.getDepartmentDisplayOrder(),
                    item.getEmployeeCode(),
                    item.getFullName(),
                    item.getDepartmentCode(),
                    item.getDepartmentName(),
                    item.getPositionCode(),
                    item.getPositionName(),
                    item.getWorkingConditionCode(),
                    item.getWorkingConditionName(),
                    item.getHireDate(),
                    item.getLeaveDays(),
                    HrRosterInclusionReason.CARRIED_FORWARD,
                    item.getSourceMovement(),
                    item.getCreatedAt(),
                    item.getCreatedByActor()
            );
        }

        static RosterItemDraft fromMovement(HrEmployeeMovement movement) {
            HrEmployee employee = movement.getEmployee();
            HrEmployeeEmployment employment = employee.getEmployment();
            return new RosterItemDraft(
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
                    movement,
                    movement.getCreatedAt(),
                    movement.getCreatedByActor()
            );
        }

        ProjectedRosterItem toProjected(String periodKey, int displayOrder) {
            return new ProjectedRosterItem(
                    periodKey + ":" + employee.getId(),
                    employee,
                    displayOrder,
                    departmentDisplayOrder,
                    employeeCode,
                    fullName,
                    departmentCode,
                    departmentName,
                    positionCode,
                    positionName,
                    workingConditionCode,
                    workingConditionName,
                    HrEmploymentStatus.ACTIVE,
                    hireDate,
                    null,
                    leaveDays,
                    inclusionReason,
                    sourceMovement,
                    createdAt,
                    createdByActor
            );
        }
    }

    public record ProjectedRosterItem(
            String id,
            HrEmployee employee,
            int displayOrder,
            Integer departmentDisplayOrder,
            String employeeCode,
            String fullName,
            String departmentCode,
            String departmentName,
            String positionCode,
            String positionName,
            String workingConditionCode,
            String workingConditionName,
            HrEmploymentStatus employmentStatus,
            LocalDate hireDate,
            LocalDate terminationDate,
            BigDecimal leaveDays,
            HrRosterInclusionReason inclusionReason,
            HrEmployeeMovement sourceMovement,
            LocalDateTime createdAt,
            String createdByActor
    ) {
    }
}

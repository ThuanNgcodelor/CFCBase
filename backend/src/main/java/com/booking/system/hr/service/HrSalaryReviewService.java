package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrSalaryRaiseDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrSalaryReviewBucket;
import com.booking.system.hr.enums.HrSalaryReviewStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeEmploymentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class HrSalaryReviewService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<HrSalaryReviewStatus> RESOLVED = Set.of(
            HrSalaryReviewStatus.NOT_ELIGIBLE,
            HrSalaryReviewStatus.COMPLETED
    );

    private final HrEmployeeEmploymentRepository employmentRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;

    @Transactional(readOnly = true)
    public HrSalaryRaiseDtos.ReviewDashboardResponse dashboard(
            HrSalaryReviewBucket bucket,
            String keyword,
            String departmentId,
            int page,
            int size
    ) {
        return dashboard(bucket, keyword, departmentId, page, size, LocalDate.now(BUSINESS_ZONE));
    }

    @Transactional(readOnly = true)
    HrSalaryRaiseDtos.ReviewDashboardResponse dashboard(
            HrSalaryReviewBucket bucket,
            String keyword,
            String departmentId,
            int page,
            int size,
            LocalDate today
    ) {
        HrSalaryReviewBucket safeBucket = bucket == null ? HrSalaryReviewBucket.ALL : bucket;
        String safeKeyword = like(keyword);
        String safeDepartment = trimToNull(departmentId);
        LocalDate day30 = today.plusDays(30);
        LocalDate day60 = today.plusDays(60);
        LocalDate day90 = today.plusDays(90);

        var result = employmentRepository.searchSalaryReviews(
                safeBucket.name(), safeKeyword, safeDepartment, RESOLVED,
                today, day30, day60, day90,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100))
        );
        var stats = employmentRepository.salaryReviewStats(RESOLVED, today, day30, day60, day90);
        return new HrSalaryRaiseDtos.ReviewDashboardResponse(
                today,
                new HrSalaryRaiseDtos.ReviewStats(
                        value(stats.getTotalEmployees()), value(stats.getOverdue()), value(stats.getDue30()),
                        value(stats.getDue60()), value(stats.getDue90()), value(stats.getLater()),
                        value(stats.getMissing()), value(stats.getResolved())
                ),
                HrPageResponse.from(result, employment -> toItem(employment, today))
        );
    }

    @Transactional
    public HrSalaryRaiseDtos.ReviewItem update(
            String employeeId,
            HrSalaryRaiseDtos.ReviewUpdateRequest request,
            HrImportActor actor
    ) {
        requireApprover(actor);
        HrEmployeeEmployment employment = employmentRepository.findById(employeeId)
                .orElseThrow(() -> HrApiException.notFound(
                        "SALARY_REVIEW_EMPLOYEE_NOT_FOUND", "Không tìm thấy hồ sơ công việc của nhân viên."));
        if (employment.getEmployee().getEmploymentStatus() != HrEmploymentStatus.ACTIVE) {
            throw HrApiException.conflict("SALARY_REVIEW_EMPLOYEE_INACTIVE",
                    "Chỉ rà soát nâng lương cho nhân viên đang làm việc.");
        }
        if (employment.getNextSalaryReviewDate() == null) {
            throw HrApiException.conflict("SALARY_REVIEW_DUE_DATE_MISSING",
                    "Nhân viên chưa có ngày tới hạn; hãy bổ sung bằng batch nâng lương hợp lệ.");
        }
        if (employment.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("SALARY_REVIEW_VERSION_CONFLICT",
                    "Trạng thái rà soát vừa được cập nhật ở nơi khác. Vui lòng tải lại.");
        }

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        HrSalaryReviewStatus nextStatus = request.status();
        String note = trimToNull(request.note());
        LocalDate followUpDate = null;
        if (nextStatus == HrSalaryReviewStatus.DEFERRED) {
            followUpDate = request.followUpDate();
            if (followUpDate == null || followUpDate.isBefore(today)) {
                throw HrApiException.badRequest("SALARY_REVIEW_FOLLOW_UP_INVALID",
                        "Ngày rà soát lại phải từ hôm nay trở đi.");
            }
            if (note == null) {
                throw HrApiException.badRequest("SALARY_REVIEW_NOTE_REQUIRED",
                        "Vui lòng nhập lý do hoãn rà soát.");
            }
        } else if ((nextStatus == HrSalaryReviewStatus.NOT_ELIGIBLE
                || nextStatus == HrSalaryReviewStatus.COMPLETED) && note == null) {
            throw HrApiException.badRequest("SALARY_REVIEW_NOTE_REQUIRED",
                    "Vui lòng nhập kết quả hoặc lý do rà soát.");
        }
        if (nextStatus == HrSalaryReviewStatus.PENDING) note = null;

        HrSalaryReviewStatus previousStatus = effectiveStatus(employment);
        employment.setSalaryReviewStatus(nextStatus);
        employment.setSalaryReviewFollowUpDate(followUpDate);
        employment.setSalaryReviewNote(note);
        employment.setSalaryReviewStatusUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
        employment.setSalaryReviewStatusUpdatedByActor(actor.subject());
        touch(employment, actor);
        employmentRepository.save(employment);

        auditRepository.save(audit(actor, employment, previousStatus, nextStatus, followUpDate));
        return toItem(employment, today);
    }

    private HrSalaryRaiseDtos.ReviewItem toItem(HrEmployeeEmployment employment, LocalDate today) {
        LocalDate effectiveDate = effectiveReviewDate(employment);
        Long days = effectiveDate == null ? null : ChronoUnit.DAYS.between(today, effectiveDate);
        return new HrSalaryRaiseDtos.ReviewItem(
                employment.getEmployeeId(),
                employment.getEmployee().getEmployeeCode(),
                employment.getEmployee().getFullName(),
                employment.getDepartment() == null ? null : employment.getDepartment().getId(),
                employment.getDepartment() == null ? null : employment.getDepartment().getName(),
                employment.getPosition() == null ? null : employment.getPosition().getName(),
                employment.getBaseSalary(), employment.getAllowance(), employment.getSalaryGrade(),
                employment.getSalaryScaleCode(), employment.getSalaryReviewCycleMonths(),
                employment.getLastSalaryRaiseDate(), employment.getNextSalaryReviewDate(), effectiveDate, days,
                effectiveStatus(employment), employment.getSalaryReviewFollowUpDate(), reviewNote(employment),
                employment.getSalaryReviewStatusUpdatedAt(), employment.getSalaryReviewStatusUpdatedByActor(),
                employment.getRowVersion()
        );
    }

    private HrAuditEvent audit(HrImportActor actor, HrEmployeeEmployment employment,
                               HrSalaryReviewStatus previousStatus, HrSalaryReviewStatus nextStatus,
                               LocalDate followUpDate) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction("HR_SALARY_REVIEW_STATUS_UPDATED");
        event.setEntityType("HR_SALARY_REVIEW");
        event.setEntityId(employment.getEmployeeId());
        event.setChangedFields(json(Map.of("fields", new String[]{
                "salaryReviewStatus", "salaryReviewFollowUpDate", "salaryReviewNote"
        })));
        event.setSanitizedMetadata(json(Map.of(
                "employeeCode", employment.getEmployee().getEmployeeCode(),
                "dueDate", employment.getNextSalaryReviewDate().toString(),
                "previousStatus", previousStatus.name(),
                "nextStatus", nextStatus.name(),
                "followUpDate", followUpDate == null ? "" : followUpDate.toString()
        )));
        return event;
    }

    private String json(Object value) {
        try {
            return jsonCodec.write(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi audit rà soát nâng lương.", exception);
        }
    }

    private static LocalDate effectiveReviewDate(HrEmployeeEmployment employment) {
        return employment.getSalaryReviewStatus() == HrSalaryReviewStatus.DEFERRED
                ? employment.getSalaryReviewFollowUpDate()
                : employment.getNextSalaryReviewDate();
    }

    private static HrSalaryReviewStatus effectiveStatus(HrEmployeeEmployment employment) {
        if (employment.getSalaryReviewStatus() == null
                && employment.getNextSalaryReviewDate() == null
                && employment.getSalaryReviewCycleMonths() == null
                && employment.getLastSalaryRaiseDate() != null) {
            return HrSalaryReviewStatus.COMPLETED;
        }
        return employment.getSalaryReviewStatus() == null
                ? HrSalaryReviewStatus.PENDING
                : employment.getSalaryReviewStatus();
    }

    private static String reviewNote(HrEmployeeEmployment employment) {
        if (employment.getSalaryReviewNote() != null) return employment.getSalaryReviewNote();
        return effectiveStatus(employment) == HrSalaryReviewStatus.COMPLETED
                && employment.getNextSalaryReviewDate() == null
                ? "Không có kỳ xét tiếp theo theo file nâng lương."
                : null;
    }

    private static void requireApprover(HrImportActor actor) {
        if (!Set.of("ADMIN", "MANAGER").contains(actor.role())) {
            throw HrApiException.forbidden("SALARY_REVIEW_APPROVER_REQUIRED",
                    "Chỉ ADMIN hoặc MANAGER được cập nhật trạng thái rà soát nâng lương.");
        }
    }

    private static void touch(HrEmployeeEmployment value, HrImportActor actor) {
        value.setUpdatedByActor(actor.subject());
    }

    private static String like(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : "%" + normalized.toLowerCase() + "%";
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static long value(Long value) {
        return Objects.requireNonNullElse(value, 0L);
    }
}

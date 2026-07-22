package com.booking.system.hr.api;

import com.booking.system.hr.api.dto.HrAuditEventResponse;
import com.booking.system.hr.api.dto.HrImportBatchResponse;
import com.booking.system.hr.api.dto.HrMovementResponse;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrRosterItemResponse;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrExcelImportBatchRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HrActivityQueryService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private final HrEmployeeMovementRepository movementRepository;
    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrExcelImportBatchRepository importBatchRepository;

    public HrActivityQueryService(
            HrEmployeeMovementRepository movementRepository,
            HrMonthlyRosterRepository rosterRepository,
            HrMonthlyRosterItemRepository rosterItemRepository,
            HrAuditEventRepository auditRepository,
            HrExcelImportBatchRepository importBatchRepository
    ) {
        this.movementRepository = movementRepository;
        this.rosterRepository = rosterRepository;
        this.rosterItemRepository = rosterItemRepository;
        this.auditRepository = auditRepository;
        this.importBatchRepository = importBatchRepository;
    }

    public HrPageResponse<HrMovementResponse> movements(int page, int size) {
        Pageable pageable = pageRequest(page, size,
                Sort.by(Sort.Order.desc("effectiveDate"), Sort.Order.desc("createdAt")));
        return HrPageResponse.from(movementRepository.findActivityPage(pageable), HrMovementResponse::from);
    }

    public HrPageResponse<HrRosterResponse> rosters(int page, int size) {
        Pageable pageable = pageRequest(page, size, Sort.by(Sort.Order.desc("periodStart")));
        return HrPageResponse.from(rosterRepository.findAll(pageable), HrRosterResponse::from);
    }

    public HrPageResponse<HrRosterItemResponse> rosterItems(String rosterId, int page, int size) {
        if (rosterId == null || rosterId.isBlank() || !rosterRepository.existsById(rosterId)) {
            throw HrApiException.notFound("HR_ROSTER_NOT_FOUND", "Không tìm thấy danh sách nhân sự tháng.");
        }
        Pageable pageable = pageRequest(page, size, Sort.unsorted());
        return HrPageResponse.from(
                rosterItemRepository.findByRoster_IdOrderByDisplayOrder(rosterId, pageable),
                HrRosterItemResponse::from
        );
    }

    public HrPageResponse<HrAuditEventResponse> auditEvents(int page, int size) {
        Pageable pageable = pageRequest(page, size,
                Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.desc("id")));
        return HrPageResponse.from(auditRepository.findAll(pageable), HrAuditEventResponse::from);
    }

    public HrPageResponse<HrImportBatchResponse> imports(int page, int size) {
        Pageable pageable = pageRequest(page, size, Sort.by(Sort.Order.desc("createdAt")));
        return HrPageResponse.from(importBatchRepository.findAll(pageable), HrImportBatchResponse::from);
    }

    static PageRequest pageRequest(int page, int size, Sort sort) {
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        return PageRequest.of(safePage, safeSize, sort);
    }
}

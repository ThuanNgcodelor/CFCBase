package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrAuditEventRepository extends HrRepository<HrAuditEvent, Long> {
    Page<HrAuditEvent> findByEntityTypeAndEntityIdOrderByOccurredAtDesc(
            String entityType,
            String entityId,
            Pageable pageable
    );
}

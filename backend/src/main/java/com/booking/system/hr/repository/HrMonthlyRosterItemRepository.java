package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRosterItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrMonthlyRosterItemRepository extends HrRepository<HrMonthlyRosterItem, String> {
    Page<HrMonthlyRosterItem> findByRoster_IdOrderByDisplayOrder(String rosterId, Pageable pageable);
}

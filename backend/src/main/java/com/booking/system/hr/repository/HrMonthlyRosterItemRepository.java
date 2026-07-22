package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRosterItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface HrMonthlyRosterItemRepository extends HrRepository<HrMonthlyRosterItem, String> {
    Page<HrMonthlyRosterItem> findByRoster_IdOrderByDisplayOrder(String rosterId, Pageable pageable);

    List<HrMonthlyRosterItem> findAllByRoster_IdOrderByDisplayOrder(String rosterId);

    @Query("""
            select count(item) from HrMonthlyRosterItem item
            where item.employee.id in :employeeIds and item.roster.id <> :rosterId
            """)
    long countDownstreamRosterItems(Collection<String> employeeIds, String rosterId);
}

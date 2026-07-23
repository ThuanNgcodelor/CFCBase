package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRosterItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface HrMonthlyRosterItemRepository extends HrRepository<HrMonthlyRosterItem, String> {
    Page<HrMonthlyRosterItem> findByRoster_IdOrderByDisplayOrder(String rosterId, Pageable pageable);

    @EntityGraph(attributePaths = {
            "employee",
            "employee.employment",
            "employee.employment.department",
            "employee.employment.position",
            "employee.employment.workingCondition",
            "employee.identity",
            "employee.insurance",
            "employee.contact",
            "sourceMovement"
    })
    List<HrMonthlyRosterItem> findAllByRoster_IdOrderByDisplayOrder(String rosterId);

    long countByEmployee_Id(String employeeId);

    long countBySourceMovement_Id(String movementId);

    long countByRoster_Id(String rosterId);

    @Query("""
            select count(item) from HrMonthlyRosterItem item
            where item.employee.id in :employeeIds and item.roster.id <> :rosterId
            """)
    long countDownstreamRosterItems(Collection<String> employeeIds, String rosterId);
}

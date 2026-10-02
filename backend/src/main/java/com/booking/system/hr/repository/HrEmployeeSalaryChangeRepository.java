package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeSalaryChange;
import com.booking.system.hr.enums.HrSalaryChangeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface HrEmployeeSalaryChangeRepository extends HrRepository<HrEmployeeSalaryChange, String> {

    @EntityGraph(attributePaths = {"employee", "importBatch"})
    List<HrEmployeeSalaryChange> findAllByImportBatch_IdOrderBySourceRowNumber(String batchId);

    @EntityGraph(attributePaths = {"employee", "importBatch"})
    Page<HrEmployeeSalaryChange> findByEmployee_Id(String employeeId, Pageable pageable);

    @EntityGraph(attributePaths = "employee")
    List<HrEmployeeSalaryChange> findByStatusAndEffectiveDateLessThanEqual(
            HrSalaryChangeStatus status, LocalDate effectiveDate);

    @EntityGraph(attributePaths = "employee")
    @Query("""
            select change from HrEmployeeSalaryChange change
            where change.employee.id in :employeeIds
              and change.status <> com.booking.system.hr.enums.HrSalaryChangeStatus.ROLLED_BACK
            order by change.employee.id, change.effectiveDate, change.createdAt, change.id
            """)
    List<HrEmployeeSalaryChange> findActiveTimeline(@Param("employeeIds") Collection<String> employeeIds);

    boolean existsByIdempotencyKey(String idempotencyKey);

    @Query("""
            select count(change) > 0 from HrEmployeeSalaryChange change
            where change.employee.id = :employeeId
              and change.status <> com.booking.system.hr.enums.HrSalaryChangeStatus.ROLLED_BACK
              and change.effectiveDate > :effectiveDate
            """)
    boolean existsActiveAfter(@Param("employeeId") String employeeId,
                              @Param("effectiveDate") LocalDate effectiveDate);
}

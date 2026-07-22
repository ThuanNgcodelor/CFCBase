package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface HrEmployeeMovementRepository extends HrRepository<HrEmployeeMovement, String> {
    @EntityGraph(attributePaths = {
            "employee",
            "fromDepartment",
            "toDepartment",
            "fromPosition",
            "toPosition",
            "fromWorkingCondition",
            "toWorkingCondition"
    })
    @Query("select movement from HrEmployeeMovement movement")
    Page<HrEmployeeMovement> findActivityPage(Pageable pageable);

    Page<HrEmployeeMovement> findByEmployee_IdOrderByEffectiveDateDesc(String employeeId, Pageable pageable);

    List<HrEmployeeMovement> findAllByImportBatch_Id(String batchId);

    @Query("""
            select count(movement) from HrEmployeeMovement movement
            where movement.employee.id in :employeeIds
              and (movement.importBatch is null or movement.importBatch.id <> :batchId)
            """)
    long countDownstreamMovements(Collection<String> employeeIds, String batchId);
}

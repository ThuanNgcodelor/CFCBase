package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrEmployeeMovementRepository extends HrRepository<HrEmployeeMovement, String> {
    @EntityGraph(attributePaths = {
            "employee",
            "employee.employment",
            "employee.employment.department",
            "employee.employment.position",
            "employee.employment.workingCondition",
            "employee.identity",
            "employee.insurance",
            "employee.contact",
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

    Optional<HrEmployeeMovement> findByIdempotencyKey(String idempotencyKey);

    boolean existsByEmployee_IdAndStatus(String employeeId, HrMovementStatus status);

    boolean existsByStatus(HrMovementStatus status);

    long countByEmployee_Id(String employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "employee", "employee.employment", "employee.employment.department",
            "employee.employment.position", "employee.employment.workingCondition",
            "fromDepartment", "toDepartment", "fromPosition", "toPosition",
            "fromWorkingCondition", "toWorkingCondition"
    })
    @Query("select movement from HrEmployeeMovement movement where movement.id = :id")
    Optional<HrEmployeeMovement> findByIdForUpdate(@Param("id") String id);

    @EntityGraph(attributePaths = {
            "employee", "employee.employment", "employee.employment.department",
            "employee.employment.position", "employee.employment.workingCondition",
            "fromDepartment", "toDepartment", "fromPosition", "toPosition",
            "fromWorkingCondition", "toWorkingCondition"
    })
    @Query("""
            select movement from HrEmployeeMovement movement
            where movement.status = :status
              and movement.movementType in :types
              and movement.effectiveDate <= :periodEnd
            order by movement.effectiveDate asc, movement.createdAt asc, movement.id asc
            """)
    List<HrEmployeeMovement> findConfirmedForSnapshot(
            @Param("status") HrMovementStatus status,
            @Param("types") Collection<HrMovementType> types,
            @Param("periodEnd") LocalDate periodEnd
    );

    @EntityGraph(attributePaths = {
            "employee",
            "fromDepartment",
            "toDepartment",
            "fromPosition",
            "toPosition",
            "fromWorkingCondition",
            "toWorkingCondition"
    })
    @Query("""
            select movement from HrEmployeeMovement movement
            where movement.status = :status
              and movement.movementType in :types
              and movement.effectiveDate between :from and :to
            order by movement.effectiveDate asc, movement.createdAt asc, movement.id asc
            """)
    List<HrEmployeeMovement> findConfirmedForExport(
            @Param("status") HrMovementStatus status,
            @Param("types") Collection<HrMovementType> types,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}

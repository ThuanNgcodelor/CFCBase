package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmploymentContract;
import com.booking.system.hr.enums.HrEmploymentContractStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrEmploymentContractRepository extends HrRepository<HrEmploymentContract, String> {

    @EntityGraph(attributePaths = {"employee", "sourceProbationCandidate"})
    Optional<HrEmploymentContract> findByIdempotencyKey(String idempotencyKey);

    boolean existsByContractNumber(String contractNumber);

    long countByEmployee_Id(String employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "employee",
            "employee.employment",
            "employee.employment.department",
            "employee.employment.position",
            "employee.identity",
            "employee.contact",
            "sourceProbationCandidate"
    })
    @Query("select contract from HrEmploymentContract contract where contract.id = :contractId")
    Optional<HrEmploymentContract> findDocumentSourceByIdForUpdate(@Param("contractId") String contractId);

    @EntityGraph(attributePaths = {"employee", "sourceProbationCandidate"})
    @Query("""
            select contract from HrEmploymentContract contract
            where contract.employee.id = :employeeId
              and contract.status in :statuses
            order by contract.effectiveFrom desc, contract.createdAt desc
            """)
    List<HrEmploymentContract> findCurrent(
            @Param("employeeId") String employeeId,
            @Param("statuses") Collection<HrEmploymentContractStatus> statuses,
            Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"employee", "sourceProbationCandidate"})
    @Query("""
            select contract from HrEmploymentContract contract
            where contract.employee.id = :employeeId
              and contract.status in :statuses
            order by contract.effectiveFrom desc, contract.createdAt desc
            """)
    List<HrEmploymentContract> findCurrentForUpdate(
            @Param("employeeId") String employeeId,
            @Param("statuses") Collection<HrEmploymentContractStatus> statuses,
            Pageable pageable
    );
}

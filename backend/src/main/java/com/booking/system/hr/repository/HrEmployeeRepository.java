package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.enums.HrEmploymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

public interface HrEmployeeRepository extends HrRepository<HrEmployee, String> {
    Optional<HrEmployee> findByEmployeeCode(String employeeCode);

    boolean existsByEmployeeCode(String employeeCode);

    List<HrEmployee> findAllByEmployeeCodeIn(Collection<String> employeeCodes);

    List<HrEmployee> findAllBySourceImportBatch_Id(String batchId);

    Page<HrEmployee> findByEmploymentStatus(HrEmploymentStatus status, Pageable pageable);

    long countByEmploymentStatus(HrEmploymentStatus status);

    @EntityGraph(attributePaths = {
            "employment", "employment.department", "employment.position", "employment.workingCondition"
    })
    @Query(value = """
            select employee from HrEmployee employee
            left join employee.employment employment
            left join employment.department department
            left join employment.position position
            left join employment.workingCondition workingCondition
            where (:keyword is null
                or lower(employee.employeeCode) like :keyword
                or lower(employee.fullName) like :keyword)
              and (:status is null or employee.employmentStatus = :status)
              and (:departmentId is null or department.id = :departmentId)
              and (:positionId is null or position.id = :positionId)
              and (:workingConditionId is null or workingCondition.id = :workingConditionId)
            """,
            countQuery = """
            select count(employee) from HrEmployee employee
            left join employee.employment employment
            left join employment.department department
            left join employment.position position
            left join employment.workingCondition workingCondition
            where (:keyword is null
                or lower(employee.employeeCode) like :keyword
                or lower(employee.fullName) like :keyword)
              and (:status is null or employee.employmentStatus = :status)
              and (:departmentId is null or department.id = :departmentId)
              and (:positionId is null or position.id = :positionId)
              and (:workingConditionId is null or workingCondition.id = :workingConditionId)
            """)
    Page<HrEmployee> search(
            @Param("keyword") String keyword,
            @Param("status") HrEmploymentStatus status,
            @Param("departmentId") String departmentId,
            @Param("positionId") String positionId,
            @Param("workingConditionId") String workingConditionId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "employment", "employment.department", "employment.position", "employment.workingCondition",
            "identity", "insurance", "contact"
    })
    @Query("select employee from HrEmployee employee where employee.id = :id")
    Optional<HrEmployee> findDetailById(@Param("id") String id);
}

package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrDepartment;

import java.util.Optional;
import com.booking.system.hr.enums.HrCatalogStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrDepartmentRepository extends HrRepository<HrDepartment, String> {
    Optional<HrDepartment> findByCode(String code);

    Optional<HrDepartment> findByName(String name);

    boolean existsByCode(String code);

    long countByStatus(HrCatalogStatus status);

    @EntityGraph(attributePaths = "parent")
    @Query("""
            select department from HrDepartment department
            where (:status is null or department.status = :status)
              and (:keyword is null or lower(department.code) like :keyword or lower(department.name) like :keyword)
            """)
    Page<HrDepartment> search(@Param("status") HrCatalogStatus status,
                              @Param("keyword") String keyword,
                              Pageable pageable);
}

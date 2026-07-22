package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrWorkingCondition;

import java.util.Optional;
import com.booking.system.hr.enums.HrCatalogStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrWorkingConditionRepository extends HrRepository<HrWorkingCondition, String> {
    Optional<HrWorkingCondition> findByCode(String code);

    Optional<HrWorkingCondition> findByName(String name);

    boolean existsByCode(String code);

    long countByStatus(HrCatalogStatus status);

    @Query("""
            select condition from HrWorkingCondition condition
            where (:status is null or condition.status = :status)
              and (:keyword is null or lower(condition.code) like :keyword or lower(condition.name) like :keyword)
            """)
    Page<HrWorkingCondition> search(@Param("status") HrCatalogStatus status,
                                    @Param("keyword") String keyword,
                                    Pageable pageable);
}

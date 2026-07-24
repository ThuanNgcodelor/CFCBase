package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrProbationJobTemplate;
import com.booking.system.hr.enums.HrCatalogStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HrProbationJobTemplateRepository extends HrRepository<HrProbationJobTemplate, String> {
    Optional<HrProbationJobTemplate> findByCode(String code);

    Optional<HrProbationJobTemplate> findByName(String name);

    @EntityGraph(attributePaths = {"department", "position", "workingCondition"})
    @Query("""
            select template from HrProbationJobTemplate template
            where (:status is null or template.status = :status)
              and (:keyword is null
                or lower(template.code) like :keyword
                or lower(template.name) like :keyword)
            """)
    Page<HrProbationJobTemplate> search(
            @Param("status") HrCatalogStatus status,
            @Param("keyword") String keyword,
            Pageable pageable
    );
}

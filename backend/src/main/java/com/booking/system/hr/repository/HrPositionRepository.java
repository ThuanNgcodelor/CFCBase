package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPosition;

import java.util.Optional;
import com.booking.system.hr.enums.HrCatalogStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrPositionRepository extends HrRepository<HrPosition, String> {
    Optional<HrPosition> findByCode(String code);

    Optional<HrPosition> findByName(String name);

    boolean existsByCode(String code);

    long countByStatus(HrCatalogStatus status);

    @Query("""
            select position from HrPosition position
            where (:status is null or position.status = :status)
              and (:keyword is null or lower(position.code) like :keyword or lower(position.name) like :keyword)
            """)
    Page<HrPosition> search(@Param("status") HrCatalogStatus status,
                            @Param("keyword") String keyword,
                            Pageable pageable);
}

package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPosition;

import java.util.Optional;

public interface HrPositionRepository extends HrRepository<HrPosition, String> {
    Optional<HrPosition> findByCode(String code);

    Optional<HrPosition> findByName(String name);

    boolean existsByCode(String code);
}

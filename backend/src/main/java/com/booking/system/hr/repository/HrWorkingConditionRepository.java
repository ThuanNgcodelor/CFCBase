package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrWorkingCondition;

import java.util.Optional;

public interface HrWorkingConditionRepository extends HrRepository<HrWorkingCondition, String> {
    Optional<HrWorkingCondition> findByCode(String code);

    Optional<HrWorkingCondition> findByName(String name);

    boolean existsByCode(String code);
}

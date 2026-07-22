package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrDepartment;

import java.util.Optional;

public interface HrDepartmentRepository extends HrRepository<HrDepartment, String> {
    Optional<HrDepartment> findByCode(String code);

    Optional<HrDepartment> findByName(String name);

    boolean existsByCode(String code);
}

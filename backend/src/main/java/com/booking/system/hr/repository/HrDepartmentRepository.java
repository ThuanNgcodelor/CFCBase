package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrDepartment;

import java.util.Optional;

public interface HrDepartmentRepository extends HrRepository<HrDepartment, String> {
    Optional<HrDepartment> findByCode(String code);

    boolean existsByCode(String code);
}

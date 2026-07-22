package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.enums.HrEmploymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface HrEmployeeRepository extends HrRepository<HrEmployee, String> {
    Optional<HrEmployee> findByEmployeeCode(String employeeCode);

    boolean existsByEmployeeCode(String employeeCode);

    Page<HrEmployee> findByEmploymentStatus(HrEmploymentStatus status, Pageable pageable);
}

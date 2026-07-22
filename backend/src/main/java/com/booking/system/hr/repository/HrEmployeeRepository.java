package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.enums.HrEmploymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

public interface HrEmployeeRepository extends HrRepository<HrEmployee, String> {
    Optional<HrEmployee> findByEmployeeCode(String employeeCode);

    boolean existsByEmployeeCode(String employeeCode);

    List<HrEmployee> findAllByEmployeeCodeIn(Collection<String> employeeCodes);

    List<HrEmployee> findAllBySourceImportBatch_Id(String batchId);

    Page<HrEmployee> findByEmploymentStatus(HrEmploymentStatus status, Pageable pageable);
}

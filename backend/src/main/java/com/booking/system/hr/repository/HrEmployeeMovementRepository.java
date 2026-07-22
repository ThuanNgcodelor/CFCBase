package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrEmployeeMovementRepository extends HrRepository<HrEmployeeMovement, String> {
    Page<HrEmployeeMovement> findByEmployee_IdOrderByEffectiveDateDesc(String employeeId, Pageable pageable);
}

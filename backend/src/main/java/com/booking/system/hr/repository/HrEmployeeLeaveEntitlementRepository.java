package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeLeaveEntitlement;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrEmployeeLeaveEntitlementRepository extends HrRepository<HrEmployeeLeaveEntitlement, String> {

    Optional<HrEmployeeLeaveEntitlement> findByEmployee_IdAndLeaveYear(String employeeId, short leaveYear);

    List<HrEmployeeLeaveEntitlement> findAllByEmployee_IdInAndLeaveYear(Collection<String> employeeIds, short leaveYear);
}

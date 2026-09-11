package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceIncident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrAttendanceIncidentRepository extends HrRepository<HrAttendanceIncident, String> {
    Page<HrAttendanceIncident> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

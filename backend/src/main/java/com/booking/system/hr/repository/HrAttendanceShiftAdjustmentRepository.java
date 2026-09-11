package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendanceShiftAdjustment;

import java.util.List;

public interface HrAttendanceShiftAdjustmentRepository extends HrRepository<HrAttendanceShiftAdjustment, String> {
    List<HrAttendanceShiftAdjustment> findByShiftIdOrderByCreatedAtDesc(String shiftId);
}

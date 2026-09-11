package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrProductionAttendanceShift;
import com.booking.system.hr.enums.HrProductionAttendanceShiftStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HrProductionAttendanceShiftRepository extends HrRepository<HrProductionAttendanceShift, String> {
    Page<HrProductionAttendanceShift> findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(String importId, Pageable pageable);
    Page<HrProductionAttendanceShift> findByImportIdAndActiveTrueAndStatusOrderByEmployeeCodeAscWorkDateAsc(String importId, HrProductionAttendanceShiftStatus status, Pageable pageable);
    List<HrProductionAttendanceShift> findByImportIdAndActiveTrueOrderByEmployeeCodeAscWorkDateAsc(String importId);
    List<HrProductionAttendanceShift> findAllByIdIn(List<String> ids);
    long countByImportIdAndActiveTrueAndStatus(String importId, HrProductionAttendanceShiftStatus status);

    @Query("""
            select shift from HrProductionAttendanceShift shift
            where shift.active = true and shift.importId <> :importId
              and shift.checkInPunchId is not null and shift.checkOutPunchId is not null
              and (shift.checkInPunchId in :punchIds or shift.checkOutPunchId in :punchIds)
            """)
    List<HrProductionAttendanceShift> findOtherActiveCompleteShiftsUsingPunches(
            @Param("importId") String importId, @Param("punchIds") List<String> punchIds);

    @Modifying
    @Query("update HrProductionAttendanceShift shift set shift.active = false where shift.importId = :importId and shift.active = true")
    void deactivateByImportId(String importId);
}

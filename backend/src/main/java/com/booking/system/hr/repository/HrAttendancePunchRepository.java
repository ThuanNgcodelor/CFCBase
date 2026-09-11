package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrAttendancePunch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrAttendancePunchRepository extends HrRepository<HrAttendancePunch, String> {
    List<HrAttendancePunch> findByImportIdOrderByEmployeeCodeAscPunchedAtAsc(String importId);
    Page<HrAttendancePunch> findByImportIdOrderByEmployeeCodeAscPunchedAtAsc(String importId, Pageable pageable);

    @Query("""
            select punch from HrAttendancePunch punch
            where punch.importId <> :importId and punch.employeeCode in :codes
              and punch.punchedAt >= :fromTime and punch.punchedAt < :toTime
            order by punch.employeeCode, punch.punchedAt
            """)
    List<HrAttendancePunch> findBoundaryPunches(@Param("importId") String importId,
                                                @Param("codes") List<String> codes,
                                                @Param("fromTime") LocalDateTime fromTime,
                                                @Param("toTime") LocalDateTime toTime);
}

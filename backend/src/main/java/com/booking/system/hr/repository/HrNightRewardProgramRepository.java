package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrNightRewardProgram;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface HrNightRewardProgramRepository extends HrRepository<HrNightRewardProgram, String> {
    @Query("""
            select program from HrNightRewardProgram program
            where program.active = true and program.effectiveFrom <= :date
              and (program.effectiveTo is null or program.effectiveTo >= :date)
            order by program.effectiveFrom desc
            """)
    Optional<HrNightRewardProgram> findEffective(@Param("date") LocalDate date);
}

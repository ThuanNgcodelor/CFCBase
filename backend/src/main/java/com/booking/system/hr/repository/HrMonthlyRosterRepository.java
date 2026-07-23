package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrMonthlyRoster;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HrMonthlyRosterRepository extends HrRepository<HrMonthlyRoster, String> {
    @Override
    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    Optional<HrMonthlyRoster> findById(String id);

    @Override
    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    Page<HrMonthlyRoster> findAll(Pageable pageable);

    Optional<HrMonthlyRoster> findByPeriodStart(LocalDate periodStart);

    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    List<HrMonthlyRoster> findAllByPeriodStartBetweenOrderByPeriodStartAsc(LocalDate from, LocalDate to);

    List<HrMonthlyRoster> findAllBySourceImportBatch_Id(String batchId);

    boolean existsBySourceRoster_Id(String sourceRosterId);

    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    Optional<HrMonthlyRoster> findFirstByOrderByPeriodStartDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    Optional<HrMonthlyRoster> findTopByOrderByPeriodStartDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"sourceRoster", "sourceImportBatch"})
    @Query("select roster from HrMonthlyRoster roster where roster.id = :id")
    Optional<HrMonthlyRoster> findByIdForUpdate(@Param("id") String id);
}

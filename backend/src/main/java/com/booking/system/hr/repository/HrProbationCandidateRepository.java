package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrProbationCandidate;
import com.booking.system.hr.enums.HrProbationCandidateStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HrProbationCandidateRepository extends HrRepository<HrProbationCandidate, String> {
    Optional<HrProbationCandidate> findByCandidateCode(String candidateCode);

    @EntityGraph(attributePaths = {"department", "position", "workingCondition", "jobTemplate", "convertedEmployee"})
    @Query("""
            select candidate from HrProbationCandidate candidate
            left join candidate.department department
            where (:keyword is null
                or lower(candidate.candidateCode) like :keyword
                or lower(candidate.fullName) like :keyword
                or lower(candidate.citizenId) like :keyword)
              and (:status is null or candidate.status = :status)
              and (:departmentId is null or department.id = :departmentId)
            """)
    Page<HrProbationCandidate> search(
            @Param("keyword") String keyword,
            @Param("status") HrProbationCandidateStatus status,
            @Param("departmentId") String departmentId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"department", "position", "workingCondition", "jobTemplate", "convertedEmployee"})
    @Query("select candidate from HrProbationCandidate candidate where candidate.id = :id")
    Optional<HrProbationCandidate> findDetailById(@Param("id") String id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"department", "position", "workingCondition", "jobTemplate", "convertedEmployee"})
    @Query("select candidate from HrProbationCandidate candidate where candidate.id = :id")
    Optional<HrProbationCandidate> findDetailByIdForUpdate(@Param("id") String id);
}

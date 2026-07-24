package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrProbationContract;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HrProbationContractRepository extends HrRepository<HrProbationContract, String> {
    long countByContractYear(short contractYear);

    boolean existsByContractNoAndContractYear(String contractNo, short contractYear);

    @EntityGraph(attributePaths = "candidate")
    @Query("select contract from HrProbationContract contract where contract.id = :id")
    Optional<HrProbationContract> findDetailById(@Param("id") String id);

    @Query("""
            select contract from HrProbationContract contract
            where contract.candidate.id = :candidateId
            order by contract.generatedAt desc, contract.createdAt desc
            """)
    Page<HrProbationContract> findLatestByCandidateId(@Param("candidateId") String candidateId, Pageable pageable);
}

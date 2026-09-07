package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmploymentContractDocument;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HrEmploymentContractDocumentRepository
        extends HrRepository<HrEmploymentContractDocument, String> {

    @EntityGraph(attributePaths = "employmentContract")
    @Query("select document from HrEmploymentContractDocument document where document.id = :id")
    Optional<HrEmploymentContractDocument> findDetailById(@Param("id") String id);

    long countByEmploymentContract_Id(String employmentContractId);

    // Scalar projection deliberately excludes generated_docx and snapshot_payload.
    @Query("""
            select new com.booking.system.hr.api.dto.HrEmploymentContractDtos$DocumentSummary(
                d.id, d.employmentContract.id, d.workforceGroup, d.templateFileName, d.templateSha256,
                d.generatedFileName, d.generatedFileSha256, d.generatedAt, d.generatedByActor)
            from HrEmploymentContractDocument d where d.employmentContract.id = :contractId
            """)
    org.springframework.data.domain.Page<com.booking.system.hr.api.dto.HrEmploymentContractDtos.DocumentSummary>
    findSummaries(@Param("contractId") String contractId, org.springframework.data.domain.Pageable pageable);
}

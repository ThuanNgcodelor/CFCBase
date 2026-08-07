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
}

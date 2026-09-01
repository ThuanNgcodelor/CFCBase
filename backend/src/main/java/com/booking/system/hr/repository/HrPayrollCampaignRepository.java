package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollCampaign;
import com.booking.system.hr.enums.HrPayrollCampaignStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.Optional;

public interface HrPayrollCampaignRepository extends HrRepository<HrPayrollCampaign, String> {
    @EntityGraph(attributePaths = {"payrollImport"})
    Optional<HrPayrollCampaign> findByPayrollImportId(String importId);
    @EntityGraph(attributePaths = {"payrollImport"})
    Optional<HrPayrollCampaign> findById(String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select campaign from HrPayrollCampaign campaign where campaign.id = :id")
    Optional<HrPayrollCampaign> findByIdForUpdate(@Param("id") String id);
    boolean existsByStatusIn(Collection<HrPayrollCampaignStatus> statuses);
}

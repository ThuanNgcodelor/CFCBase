package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollDelivery;
import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;

public interface HrPayrollDeliveryRepository extends HrRepository<HrPayrollDelivery, String> {
    @EntityGraph(attributePaths = {"employee", "importRow", "campaign.payrollImport"})
    Page<HrPayrollDelivery> findByCampaignIdOrderByCreatedAt(String campaignId, Pageable pageable);
    @EntityGraph(attributePaths = {"employee", "importRow", "campaign.payrollImport"})
    List<HrPayrollDelivery> findTop50ByCampaignIdAndStatusInOrderByCreatedAt(String campaignId, Collection<HrPayrollDeliveryStatus> statuses);
    List<HrPayrollDelivery> findByCampaignIdAndStatus(String campaignId, HrPayrollDeliveryStatus status);
    long countByCampaignIdAndStatus(String campaignId, HrPayrollDeliveryStatus status);
}

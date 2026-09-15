package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollTestDelivery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface HrPayrollTestDeliveryRepository extends HrRepository<HrPayrollTestDelivery, String> {
    Page<HrPayrollTestDelivery> findByCreatedByActorOrderByCreatedAtDesc(String actor, Pageable pageable);
}

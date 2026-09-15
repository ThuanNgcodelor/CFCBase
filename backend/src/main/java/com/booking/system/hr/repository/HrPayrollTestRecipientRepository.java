package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrPayrollTestRecipient;

import java.util.Optional;

public interface HrPayrollTestRecipientRepository extends HrRepository<HrPayrollTestRecipient, String> {
    Optional<HrPayrollTestRecipient> findByUserId(String userId);
    Optional<HrPayrollTestRecipient> findByLinkTokenHashAndStatus(String linkTokenHash, String status);
}

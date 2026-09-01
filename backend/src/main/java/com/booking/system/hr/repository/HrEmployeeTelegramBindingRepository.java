package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeTelegramBinding;
import com.booking.system.hr.enums.HrTelegramBindingStatus;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface HrEmployeeTelegramBindingRepository extends HrRepository<HrEmployeeTelegramBinding, String> {

    @Query("select binding from HrEmployeeTelegramBinding binding where binding.employee.id = :employeeId")
    Optional<HrEmployeeTelegramBinding> findByEmployeeId(@Param("employeeId") String employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select binding from HrEmployeeTelegramBinding binding where binding.employee.id = :employeeId")
    Optional<HrEmployeeTelegramBinding> findByEmployeeIdForUpdate(@Param("employeeId") String employeeId);

    @Query("""
            select binding from HrEmployeeTelegramBinding binding
            where binding.telegramUserId = :telegramUserId
              and binding.status = :status
            """)
    Optional<HrEmployeeTelegramBinding> findActiveByTelegramUserId(
            @Param("telegramUserId") Long telegramUserId,
            @Param("status") HrTelegramBindingStatus status
    );

    long countByStatus(HrTelegramBindingStatus status);
}

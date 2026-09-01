package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrTelegramRegistration;
import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HrTelegramRegistrationRepository extends HrRepository<HrTelegramRegistration, String> {

    @EntityGraph(attributePaths = {"employee", "employee.employment", "employee.employment.department"})
    @Query("""
            select registration from HrTelegramRegistration registration
            left join registration.employee employee
            where (:status is null or registration.status = :status)
              and (:keyword is null or lower(coalesce(registration.enteredEmployeeCode, '')) like :keyword
                   or lower(coalesce(employee.employeeCode, '')) like :keyword
                   or lower(coalesce(employee.fullName, '')) like :keyword
                   or lower(coalesce(registration.phoneNumber, '')) like :keyword
                   or lower(coalesce(registration.telegramUsername, '')) like :keyword)
            order by registration.createdAt desc
            """)
    Page<HrTelegramRegistration> search(
            @Param("status") HrTelegramRegistrationStatus status,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    Optional<HrTelegramRegistration> findTopByTelegramUserIdOrderByCreatedAtDesc(Long telegramUserId);

    Optional<HrTelegramRegistration> findTopByTelegramUserIdAndStatusInOrderByCreatedAtDesc(
            Long telegramUserId,
            Collection<HrTelegramRegistrationStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"employee"})
    @Query("select registration from HrTelegramRegistration registration where registration.id = :id")
    Optional<HrTelegramRegistration> findByIdForUpdate(@Param("id") String id);

    long countByStatus(HrTelegramRegistrationStatus status);

    @EntityGraph(attributePaths = {"employee"})
    List<HrTelegramRegistration> findAllByStatusOrderByCreatedAtDesc(HrTelegramRegistrationStatus status);
}

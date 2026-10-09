package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.enums.HrSalaryReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;

public interface HrEmployeeEmploymentRepository extends HrRepository<HrEmployeeEmployment, String> {

    interface SalaryReviewStatsProjection {
        Long getTotalEmployees();
        Long getOverdue();
        Long getDue30();
        Long getDue60();
        Long getDue90();
        Long getLater();
        Long getMissing();
        Long getResolved();
    }

    @EntityGraph(attributePaths = {"employee", "department", "position"})
    @Query(value = """
            select employment from HrEmployeeEmployment employment
            join employment.employee employee
            left join employment.department department
            left join employment.position position
            where employee.employmentStatus = com.booking.system.hr.enums.HrEmploymentStatus.ACTIVE
              and (:keyword is null
                or lower(employee.employeeCode) like :keyword
                or lower(employee.fullName) like :keyword)
              and (:departmentId is null or department.id = :departmentId)
              and (
                :bucket = 'ALL'
                or (:bucket = 'MISSING'
                    and employment.nextSalaryReviewDate is null
                    and (employment.salaryReviewCycleMonths is not null or employment.lastSalaryRaiseDate is null)
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses))
                or (:bucket = 'RESOLVED' and (
                    employment.salaryReviewStatus in :resolvedStatuses
                    or (employment.nextSalaryReviewDate is null
                        and employment.salaryReviewCycleMonths is null
                        and employment.lastSalaryRaiseDate is not null)))
                or (:bucket = 'OVERDUE'
                    and employment.nextSalaryReviewDate is not null
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) < :today)
                or (:bucket = 'DUE_30'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) between :today and :day30)
                or (:bucket = 'DUE_60'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day30
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day60)
                or (:bucket = 'DUE_90'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day60
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day90)
                or (:bucket = 'LATER'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day90)
              )
            order by case when coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) is null
                    then 1 else 0 end,
                coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate), employee.employeeCode
            """,
            countQuery = """
            select count(employment) from HrEmployeeEmployment employment
            join employment.employee employee
            left join employment.department department
            where employee.employmentStatus = com.booking.system.hr.enums.HrEmploymentStatus.ACTIVE
              and (:keyword is null
                or lower(employee.employeeCode) like :keyword
                or lower(employee.fullName) like :keyword)
              and (:departmentId is null or department.id = :departmentId)
              and (
                :bucket = 'ALL'
                or (:bucket = 'MISSING'
                    and employment.nextSalaryReviewDate is null
                    and (employment.salaryReviewCycleMonths is not null or employment.lastSalaryRaiseDate is null)
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses))
                or (:bucket = 'RESOLVED' and (
                    employment.salaryReviewStatus in :resolvedStatuses
                    or (employment.nextSalaryReviewDate is null
                        and employment.salaryReviewCycleMonths is null
                        and employment.lastSalaryRaiseDate is not null)))
                or (:bucket = 'OVERDUE'
                    and employment.nextSalaryReviewDate is not null
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) < :today)
                or (:bucket = 'DUE_30'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) between :today and :day30)
                or (:bucket = 'DUE_60'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day30
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day60)
                or (:bucket = 'DUE_90'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day60
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day90)
                or (:bucket = 'LATER'
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day90)
              )
            """)
    Page<HrEmployeeEmployment> searchSalaryReviews(
            @Param("bucket") String bucket,
            @Param("keyword") String keyword,
            @Param("departmentId") String departmentId,
            @Param("resolvedStatuses") Collection<HrSalaryReviewStatus> resolvedStatuses,
            @Param("today") LocalDate today,
            @Param("day30") LocalDate day30,
            @Param("day60") LocalDate day60,
            @Param("day90") LocalDate day90,
            Pageable pageable
    );

    @Query("""
            select count(employment) as totalEmployees,
              sum(case when employment.nextSalaryReviewDate is not null
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) < :today
                  then 1 else 0 end) as overdue,
              sum(case when (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) between :today and :day30
                  then 1 else 0 end) as due30,
              sum(case when (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day30
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day60
                  then 1 else 0 end) as due60,
              sum(case when (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day60
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) <= :day90
                  then 1 else 0 end) as due90,
              sum(case when (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                    and coalesce(employment.salaryReviewFollowUpDate, employment.nextSalaryReviewDate) > :day90
                  then 1 else 0 end) as later,
              sum(case when employment.nextSalaryReviewDate is null
                    and (employment.salaryReviewCycleMonths is not null or employment.lastSalaryRaiseDate is null)
                    and (employment.salaryReviewStatus is null or employment.salaryReviewStatus not in :resolvedStatuses)
                  then 1 else 0 end) as missing,
              sum(case when employment.salaryReviewStatus in :resolvedStatuses
                    or (employment.nextSalaryReviewDate is null
                        and employment.salaryReviewCycleMonths is null
                        and employment.lastSalaryRaiseDate is not null)
                  then 1 else 0 end) as resolved
            from HrEmployeeEmployment employment
            join employment.employee employee
            where employee.employmentStatus = com.booking.system.hr.enums.HrEmploymentStatus.ACTIVE
            """)
    SalaryReviewStatsProjection salaryReviewStats(
            @Param("resolvedStatuses") Collection<HrSalaryReviewStatus> resolvedStatuses,
            @Param("today") LocalDate today,
            @Param("day30") LocalDate day30,
            @Param("day60") LocalDate day60,
            @Param("day90") LocalDate day90
    );
}

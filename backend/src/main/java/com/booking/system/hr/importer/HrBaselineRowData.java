package com.booking.system.hr.importer;

import com.booking.system.hr.enums.HrEmployeeGender;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Explicit allowlist for T6-26. Derived source fields are retained only for
 * validation/snapshot evidence and are never mapped to employee columns.
 */
public record HrBaselineRowData(
        int sourceRowNumber,
        int displayOrder,
        Integer departmentDisplayOrder,
        String employeeCode,
        String socialInsuranceNumber,
        String fullName,
        String healthInsuranceNumber,
        BigDecimal baseSalary,
        BigDecimal allowance,
        BigDecimal sourceTotalIncome,
        HrEmployeeGender gender,
        String ethnicity,
        String religion,
        String positionName,
        String departmentName,
        LocalDate dateOfBirth,
        LocalDate hireDate,
        String contractTypeLabel,
        String contractNumber,
        String sourceYearsOfService,
        String legacyIdentityNumber,
        String citizenIdentityNumber,
        LocalDate identityIssuedDate,
        String workingConditionName,
        String identityIssuedPlace,
        String birthPlaceOriginal,
        String birthPlaceCurrent,
        String permanentAddress,
        String currentAddress,
        String phone,
        String educationLevel,
        String major,
        String jobDescription,
        BigDecimal sourceAge,
        BigDecimal leaveDays
) {
}

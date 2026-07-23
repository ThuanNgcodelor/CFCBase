package com.booking.system.hr.dto;

import com.booking.system.hr.enums.HrCatalogStatus;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrIdentityVerificationStatus;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrInsuranceStatus;
import com.booking.system.hr.enums.HrRosterStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Public API contracts for the isolated HR module. None of these records
 * exposes a JPA entity directly.
 */
public final class HrApiDtos {

    private HrApiDtos() {
    }

    public record OverviewResponse(
            long totalEmployees,
            long activeEmployees,
            long draftEmployees,
            long inactiveEmployees,
            long departmentCount,
            long positionCount,
            long workingConditionCount,
            ImportSummary latestImport,
            RosterSummary latestRoster
    ) {
    }

    public record ImportSummary(
            String id,
            HrImportBatchStatus status,
            int totalRows,
            int importedRows,
            LocalDateTime parsedAt,
            LocalDateTime validatedAt,
            LocalDateTime confirmedAt
    ) {
    }

    public record RosterSummary(
            String id,
            LocalDate periodStart,
            HrRosterStatus status,
            int itemCount
    ) {
    }

    public record EmployeeListItem(
            String id,
            String employeeCode,
            String fullName,
            HrEmployeeGender gender,
            HrEmploymentStatus employmentStatus,
            LocalDate statusEffectiveDate,
            String departmentId,
            String departmentCode,
            String departmentName,
            String positionId,
            String positionCode,
            String positionName,
            String workingConditionId,
            String workingConditionCode,
            String workingConditionName,
            LocalDate hireDate,
            long rowVersion,
            LocalDateTime updatedAt
    ) {
    }

    public record EmployeeDetail(
            String id,
            HrEmploymentStatus employmentStatus,
            LocalDate statusEffectiveDate,
            long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            PersonalDetails personal,
            EmploymentDetails employment,
            IdentityDetails identity,
            InsuranceDetails insurance,
            ContactDetails contact
    ) {
    }

    public record PersonalDetails(
            String employeeCode,
            String fullName,
            HrEmployeeGender gender,
            LocalDate dateOfBirth,
            String ethnicity,
            String religion,
            String birthPlaceOriginal,
            String birthPlaceCurrent,
            String educationLevel,
            String major
    ) {
    }

    public record EmploymentDetails(
            CatalogRef department,
            CatalogRef position,
            CatalogRef workingCondition,
            LocalDate hireDate,
            LocalDate leaveAccrualStartDate,
            LocalDate terminationDate,
            String contractTypeLabel,
            String contractNumber,
            BigDecimal baseSalary,
            BigDecimal allowance,
            boolean hasCompensationData,
            String jobDescription
    ) {
    }

    /** HR detail is Manager-only, so identity numbers are returned for review/edit. */
    public record IdentityDetails(
            String legacyIdentityNumber,
            String citizenIdentityNumber,
            LocalDate issuedDate,
            String issuedPlace,
            HrIdentityVerificationStatus verificationStatus
    ) {
    }

    /** HR detail is Manager-only, so insurance identifiers are returned for review/edit. */
    public record InsuranceDetails(
            String socialInsuranceNumber,
            String healthInsuranceNumber,
            LocalDate validFrom,
            LocalDate validUntil,
            HrInsuranceStatus status
    ) {
    }

    /** HR detail is Manager-only, so contact values are returned for review/edit. */
    public record ContactDetails(
            String permanentAddress,
            String currentAddress,
            String phone,
            String workEmail,
            String personalEmail,
            String emergencyContactName,
            String emergencyContactPhone,
            String emergencyContactRelation
    ) {
    }

    public record CatalogRef(String id, String code, String name) {
    }

    public record CreateEmployeeRequest(
            @Valid @NotNull PersonalInput personal,
            @Valid EmploymentInput employment,
            @Valid IdentityInput identity,
            @Valid InsuranceInput insurance,
            @Valid ContactInput contact
    ) {
    }

    public record UpdateEmployeeRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @Valid @NotNull PersonalInput personal,
            @Valid EmploymentInput employment,
            @Valid IdentityInput identity,
            @Valid InsuranceInput insurance,
            @Valid ContactInput contact
    ) {
    }

    public record PersonalInput(
            @NotBlank @Size(max = 32) String employeeCode,
            @NotBlank @Size(max = 255) String fullName,
            HrEmployeeGender gender,
            LocalDate dateOfBirth,
            @Size(max = 100) String ethnicity,
            @Size(max = 100) String religion,
            @Size(max = 500) String birthPlaceOriginal,
            @Size(max = 500) String birthPlaceCurrent,
            @Size(max = 255) String educationLevel,
            @Size(max = 255) String major
    ) {
    }

    public record EmploymentInput(
            String departmentId,
            String positionId,
            String workingConditionId,
            LocalDate hireDate,
            LocalDate leaveAccrualStartDate,
            LocalDate terminationDate,
            @Size(max = 100) String contractTypeLabel,
            @Size(max = 100) String contractNumber,
            @DecimalMin(value = "0.0") BigDecimal baseSalary,
            @DecimalMin(value = "0.0") BigDecimal allowance,
            @Size(max = 2000) String jobDescription
    ) {
    }

    public record IdentityInput(
            @Size(max = 32) String legacyIdentityNumber,
            @Size(max = 32) String citizenIdentityNumber,
            LocalDate issuedDate,
            @Size(max = 255) String issuedPlace,
            HrIdentityVerificationStatus verificationStatus
    ) {
    }

    public record InsuranceInput(
            @Size(max = 32) String socialInsuranceNumber,
            @Size(max = 32) String healthInsuranceNumber,
            LocalDate validFrom,
            LocalDate validUntil,
            HrInsuranceStatus status
    ) {
    }

    public record ContactInput(
            @Size(max = 1000) String permanentAddress,
            @Size(max = 1000) String currentAddress,
            @Size(max = 32) String phone,
            @Size(max = 320) String workEmail,
            @Size(max = 320) String personalEmail,
            @Size(max = 255) String emergencyContactName,
            @Size(max = 32) String emergencyContactPhone,
            @Size(max = 100) String emergencyContactRelation
    ) {
    }

    public record CatalogResponse(
            String id,
            String code,
            String name,
            String description,
            HrCatalogStatus status,
            int sortOrder,
            String parentId,
            String parentName,
            long rowVersion,
            LocalDateTime updatedAt
    ) {
    }

    public record CreateCatalogRequest(
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 1000) String description,
            @PositiveOrZero Integer sortOrder,
            String parentId
    ) {
    }

    public record UpdateCatalogRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 1000) String description,
            @PositiveOrZero Integer sortOrder,
            String parentId,
            HrCatalogStatus status
    ) {
    }
}

package com.booking.system.hr.api.dto;

import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.enums.HrCatalogStatus;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrProbationCandidateStatus;
import com.booking.system.hr.enums.HrProbationContractStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class HrProbationDtos {

    private HrProbationDtos() {
    }

    public record CandidateSummary(
            String id,
            String candidateCode,
            String fullName,
            HrEmployeeGender gender,
            LocalDate dateOfBirth,
            String phone,
            HrApiDtos.CatalogRef department,
            HrApiDtos.CatalogRef position,
            HrProbationCandidateStatus status,
            LocalDate probationStartDate,
            LocalDate probationEndDate,
            ContractSummary latestContract,
            String convertedEmployeeId,
            long rowVersion,
            LocalDateTime updatedAt
    ) {
    }

    public record CandidateDetail(
            String id,
            String candidateCode,
            String fullName,
            String candidateTitle,
            HrEmployeeGender gender,
            LocalDate dateOfBirth,
            String birthPlace,
            String nationality,
            String citizenId,
            LocalDate citizenIdIssuedDate,
            String citizenIdIssuedPlace,
            String permanentAddress,
            String phone,
            String email,
            HrApiDtos.CatalogRef department,
            HrApiDtos.CatalogRef position,
            HrApiDtos.CatalogRef workingCondition,
            JobTemplateSummary jobTemplate,
            String probationContractType,
            LocalDate probationStartDate,
            LocalDate probationEndDate,
            BigDecimal baseSalary,
            String salaryNote,
            String jobDescription,
            String departmentRuleNote,
            HrProbationCandidateStatus status,
            String statusReason,
            ContractSummary latestContract,
            String convertedEmployeeId,
            String convertedEmployeeCode,
            LocalDateTime convertedAt,
            long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record CandidateInput(
            @Size(max = 32) String candidateCode,
            @NotBlank @Size(max = 255) String fullName,
            @Size(max = 16) String candidateTitle,
            HrEmployeeGender gender,
            LocalDate dateOfBirth,
            @Size(max = 500) String birthPlace,
            @Size(max = 100) String nationality,
            @Size(max = 32) String citizenId,
            LocalDate citizenIdIssuedDate,
            @Size(max = 255) String citizenIdIssuedPlace,
            @Size(max = 1000) String permanentAddress,
            @Size(max = 32) String phone,
            @Size(max = 320) String email,
            String departmentId,
            String positionId,
            String workingConditionId,
            String jobTemplateId,
            @Size(max = 100) String probationContractType,
            LocalDate probationStartDate,
            LocalDate probationEndDate,
            @DecimalMin(value = "0.0") BigDecimal baseSalary,
            @Size(max = 255) String salaryNote,
            @Size(max = 2000) String jobDescription,
            @Size(max = 500) String departmentRuleNote
    ) {
    }

    public record UpdateCandidateRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @NotNull CandidateInput candidate
    ) {
    }

    public record GenerateContractRequest(
            LocalDate signDate,
            @Size(max = 32) String contractNo
    ) {
    }

    public record CandidateActionRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @Size(max = 1000) String reason
    ) {
    }

    public record ConvertToEmployeeDraftRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @Size(max = 32) String employeeCode,
            LocalDate hireDate
    ) {
    }

    public record ContractSummary(
            String id,
            String contractNo,
            short contractYear,
            String generatedFileName,
            String generatedFileSha256,
            HrProbationContractStatus status,
            LocalDateTime generatedAt,
            String generatedByActor
    ) {
    }

    public record ContractFile(
            String id,
            String fileName,
            byte[] bytes
    ) {
    }

    public record JobTemplateSummary(
            String id,
            String code,
            String name,
            String description,
            HrApiDtos.CatalogRef department,
            HrApiDtos.CatalogRef position,
            HrApiDtos.CatalogRef workingCondition,
            String probationContractType,
            BigDecimal baseSalary,
            String salaryNote,
            String jobDescription,
            String departmentRuleNote,
            HrCatalogStatus status,
            int sortOrder,
            long rowVersion
    ) {
    }

    public record JobTemplateInput(
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 1000) String description,
            String departmentId,
            String positionId,
            String workingConditionId,
            @Size(max = 100) String probationContractType,
            @Size(max = 2000) String jobDescription,
            @DecimalMin(value = "0.0") BigDecimal baseSalary,
            @Size(max = 255) String salaryNote,
            @Size(max = 500) String departmentRuleNote,
            @PositiveOrZero Integer sortOrder
    ) {
    }

    public record UpdateJobTemplateRequest(
            @NotNull @PositiveOrZero Long rowVersion,
            @NotNull JobTemplateInput template,
            HrCatalogStatus status
    ) {
    }
}

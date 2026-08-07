package com.booking.system.hr.api.dto;

import com.booking.system.hr.dto.HrApiDtos;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class HrOnboardingDtos {

    private HrOnboardingDtos() {
    }

    public record GeneralLaborOnboardingRequest(
            @NotBlank @Size(max = 100) String idempotencyKey,
            @Valid @NotNull HrApiDtos.CreateEmployeeRequest employee,
            @Valid @NotNull HrApiDtos.EmploymentContractInput contract
    ) {
    }

    public record GeneralLaborOnboardingResponse(
            HrApiDtos.EmployeeDetail employee,
            HrApiDtos.EmploymentContractSummary contract,
            String nextAction
    ) {
    }
}

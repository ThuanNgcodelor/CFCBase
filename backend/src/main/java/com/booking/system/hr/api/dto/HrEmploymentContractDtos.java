package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrWorkforceGroup;

import java.time.LocalDateTime;

public final class HrEmploymentContractDtos {

    private HrEmploymentContractDtos() {
    }

    public record DocumentSummary(
            String id,
            String employmentContractId,
            HrWorkforceGroup workforceGroup,
            String templateFileName,
            String templateSha256,
            String generatedFileName,
            String generatedFileSha256,
            LocalDateTime generatedAt,
            String generatedByActor
    ) {
    }

    public record DocumentFile(
            String id,
            String fileName,
            byte[] bytes
    ) {
    }
}

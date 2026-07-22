package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record HrImportConfirmRequest(
        @NotBlank(message = "Confirmation key là bắt buộc")
        @Size(max = 100, message = "Confirmation key không được quá 100 ký tự")
        String confirmationKey,
        boolean acceptWarnings
) {
}

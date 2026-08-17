package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrDocumentCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class HrEmployeeDocumentDtos {

    private HrEmployeeDocumentDtos() {
    }

    public record DocumentSummary(
            String id,
            String employeeId,
            HrDocumentCategory documentCategory,
            String documentName,
            String fileName,
            String fileType,
            long fileSizeBytes,
            String fileSha256,
            String documentNumber,
            LocalDate issueDate,
            LocalDate expiryDate,
            String issuingAuthority,
            String note,
            LocalDateTime createdAt,
            String createdByActor,
            LocalDateTime updatedAt,
            String updatedByActor,
            long rowVersion
    ) {
    }

    public record UploadRequest(
            @NotNull(message = "Danh mục hồ sơ là bắt buộc.")
            HrDocumentCategory documentCategory,

            @NotBlank(message = "Tên hồ sơ là bắt buộc.")
            @Size(max = 255, message = "Tên hồ sơ không được quá 255 ký tự.")
            String documentName,

            @Size(max = 100, message = "Số hiệu văn bản không được quá 100 ký tự.")
            String documentNumber,

            LocalDate issueDate,

            LocalDate expiryDate,

            @Size(max = 255, message = "Nơi cấp không được quá 255 ký tự.")
            String issuingAuthority,

            @Size(max = 1000, message = "Ghi chú không được quá 1000 ký tự.")
            String note
    ) {
    }

    public record UpdateRequest(
            @NotNull(message = "Danh mục hồ sơ là bắt buộc.")
            HrDocumentCategory documentCategory,

            @NotBlank(message = "Tên hồ sơ là bắt buộc.")
            @Size(max = 255, message = "Tên hồ sơ không được quá 255 ký tự.")
            String documentName,

            @Size(max = 100, message = "Số hiệu văn bản không được quá 100 ký tự.")
            String documentNumber,

            LocalDate issueDate,

            LocalDate expiryDate,

            @Size(max = 255, message = "Nơi cấp không được quá 255 ký tự.")
            String issuingAuthority,

            @Size(max = 1000, message = "Ghi chú không được quá 1000 ký tự.")
            String note,

            long rowVersion
    ) {
    }

    public record DocumentFile(
            String id,
            String fileName,
            String fileType,
            byte[] bytes
    ) {
    }
}

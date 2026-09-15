package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrPayrollCampaignStatus;
import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import com.booking.system.hr.enums.HrPayrollImportStatus;
import com.booking.system.hr.enums.HrPayrollRowStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class HrPayrollDtos {
    private HrPayrollDtos() {}
    public record ImportResponse(String id, String fileName, String payrollMonth, HrPayrollImportStatus status,
                                 int totalRows, int validRows, int readyRows, int skippedRows, int invalidRows,
                                 String lastError, LocalDateTime createdAt) {}
    public record PayrollRowResponse(String id, int rowNumber, String employeeCode, String employeeName,
                                     HrPayrollRowStatus status, String errorMessage,
                                     Map<String, Object> values) {}
    public record PreviewResponse(ImportResponse batch, HrPageResponse<PayrollRowResponse> rows) {}
    public record CampaignResponse(String id, String importId, String fileName, String payrollMonth,
                                   HrPayrollCampaignStatus status, int total, int pending, int sending, int sent,
                                   int retry, int failed, int skipped, int batchSize, LocalDateTime startedAt,
                                   LocalDateTime finishedAt, String lastError) {}
    public record CreateCampaignRequest(@Size(max = 16) String deliveryMode,
                                        @Size(max = 24) String selectionMode,
                                        @Size(max = 500) List<String> rowIds) {
        public CreateCampaignRequest(String deliveryMode) {
            this(deliveryMode, "ALL_ELIGIBLE", List.of());
        }
    }
    public record PayrollDeliveryResponse(String id, String employeeCode, String employeeName,
                                          HrPayrollDeliveryStatus status, int attemptCount,
                                          String lastError, LocalDateTime sentAt, boolean documentAvailable) {}
    public record SendTextRequest(@NotBlank String text) {}
    public record ResendRequest(@NotBlank @Size(max = 500) String reason) {}
    public record TestRecipientResponse(String id, String status, String telegramUsername, Long telegramUserId,
                                        LocalDateTime linkedAt, String linkUrl, LocalDateTime linkExpiresAt) {}
    public record TestDeliveryResponse(String id, String employeeCode, String employeeName,
                                       HrPayrollDeliveryStatus status, String lastError, LocalDateTime sentAt) {}
}

package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class HrTelegramDtos {

    private HrTelegramDtos() {
    }

    public record SettingsResponse(
            String botUsername,
            boolean enabled,
            boolean botTokenConfigured,
            boolean webhookSecretConfigured,
            LocalDateTime updatedAt
    ) {
    }

    public record SettingsRequest(
            @Size(max = 64) String botUsername,
            Boolean enabled
    ) {
    }

    public record RegistrationResponse(
            String id,
            String employeeId,
            String employeeCode,
            String employeeName,
            String phoneNumber,
            Long telegramUserId,
            Long telegramChatId,
            String telegramUsername,
            HrTelegramRegistrationStatus status,
            int attemptCount,
            LocalDateTime createdAt,
            LocalDateTime reviewedAt,
            String reviewedByActor,
            String reviewNote
    ) {
    }

    public record EmployeeStatusResponse(
            String employeeId,
            String registrationId,
            String employeeCode,
            String employeeName,
            String phoneNumber,
            Long telegramUserId,
            String telegramUsername,
            String status,
            LocalDateTime registeredAt,
            LocalDateTime reviewedAt,
            String reviewedByActor,
            String reviewNote,
            LocalDateTime revokedAt,
            String revokedReason
    ) {
    }

    public record ReviewRequest(@Size(max = 1000) String note) {
    }

    public record RevokeRequest(
            @NotBlank(message = "Lý do thu hồi là bắt buộc")
            @Size(max = 500, message = "Lý do thu hồi không được vượt quá 500 ký tự")
            String note
    ) {
    }

    public record SummaryResponse(
            long total,
            long pendingReview,
            long verified,
            long rejected,
            long revoked
    ) {
    }

    public record WebhookResult(String status) {
    }
}

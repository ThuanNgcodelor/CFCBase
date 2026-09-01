package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
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

    public record ReviewRequest(@Size(max = 1000) String note) {
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

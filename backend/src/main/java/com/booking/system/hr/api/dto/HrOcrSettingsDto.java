package com.booking.system.hr.api.dto;

public record HrOcrSettingsDto(
        String provider,
        String geminiApiKey,
        String geminiModel,
        String groqApiKey,
        String groqModel,
        boolean hasGeminiKey,
        boolean hasGroqKey
) {}

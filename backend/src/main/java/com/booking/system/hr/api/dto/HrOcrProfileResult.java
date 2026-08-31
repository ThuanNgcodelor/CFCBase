package com.booking.system.hr.api.dto;

public record HrOcrProfileResult(
        String fullName,
        String gender,
        String dateOfBirth,
        String ethnicity,
        String religion,
        String birthPlaceOriginal,
        String birthPlaceCurrent,
        String educationLevel,
        String major,
        String legacyIdentityNumber,
        String citizenIdentityNumber,
        String issuedDate,
        String issuedPlace,
        String socialInsuranceNumber,
        String healthInsuranceNumber,
        String phone,
        String personalEmail,
        String permanentAddress,
        String currentAddress,
        String emergencyContactName,
        String emergencyContactPhone,
        String emergencyContactRelation,
        String providerUsed,
        String rawOcrText
) {}

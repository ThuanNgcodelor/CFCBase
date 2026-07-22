package com.booking.system.hr.importer;

public record HrImportActor(String subject, String displayName, String role) {

    public HrImportActor {
        subject = required(subject, "subject", 320);
        displayName = optional(displayName, 255);
        role = required(role, "role", 32);
    }

    public static HrImportActor systemRetentionActor() {
        return new HrImportActor("SYSTEM:HR_IMPORT_RETENTION", "HR import retention", "SYSTEM");
    }

    private static String required(String value, String field, int maxLength) {
        String normalized = optional(value, maxLength);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private static String optional(String value, int maxLength) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException("Actor field exceeds " + maxLength + " characters");
        }
        return normalized;
    }
}

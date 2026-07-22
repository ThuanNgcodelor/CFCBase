package com.booking.system.hr.importer;

import java.util.Objects;

public record HrImportIssue(
        HrImportIssueCode code,
        HrImportIssueSeverity severity,
        String cell,
        String field,
        String message
) {
    public HrImportIssue {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(severity, "severity");
        cell = cell == null ? "" : cell;
        field = field == null ? "" : field;
        message = message == null ? "" : message;
    }
}

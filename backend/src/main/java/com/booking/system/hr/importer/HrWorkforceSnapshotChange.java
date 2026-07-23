package com.booking.system.hr.importer;

import java.time.LocalDate;

public record HrWorkforceSnapshotChange(
        String employeeCode,
        String fullName,
        LocalDate effectiveDate
) {
}

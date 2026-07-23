package com.booking.system.hr.importer;

public record HrWorkforceSnapshotResult(
        String batchId,
        String fileSha256,
        int increasedEmployees,
        int decreasedEmployees,
        int updatedProfiles,
        long activeEmployees,
        long totalEmployees,
        boolean bootstrapped,
        boolean replayed
) {
}

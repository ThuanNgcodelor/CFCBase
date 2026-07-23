package com.booking.system.hr.importer;

import org.springframework.stereotype.Service;

@Service
public class HrWorkforceSnapshotImportService {

    private final HrBaselineWorkbookParser parser;
    private final HrWorkforceSnapshotContract contract;
    private final HrWorkforceSnapshotPersistence persistence;

    public HrWorkforceSnapshotImportService(
            HrBaselineWorkbookParser parser,
            HrWorkforceSnapshotContract contract,
            HrWorkforceSnapshotPersistence persistence
    ) {
        this.parser = parser;
        this.contract = contract;
        this.persistence = persistence;
    }

    public HrWorkforceSnapshotPreview preview(
            String originalFileName,
            byte[] workbookBytes
    ) {
        HrParsedBaselineWorkbook workbook = parser.parseWorkforceSnapshot(workbookBytes);
        contract.verify(workbook);
        return persistence.preview(originalFileName, workbook);
    }

    public HrWorkforceSnapshotResult confirm(
            String originalFileName,
            byte[] workbookBytes,
            String confirmationKey,
            int expectedActiveEmployees,
            HrImportActor actor
    ) {
        HrParsedBaselineWorkbook workbook = parser.parseWorkforceSnapshot(workbookBytes);
        contract.verify(workbook);
        return persistence.confirm(
                originalFileName,
                workbook,
                confirmationKey,
                expectedActiveEmployees,
                actor
        );
    }
}

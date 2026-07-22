package com.booking.system.hr.importer;

import org.springframework.stereotype.Service;

@Service
public class HrBaselineImportService {

    private final HrBaselineWorkbookParser parser;
    private final HrBaselineImportContract contract;
    private final HrBaselineImportPersistence persistence;

    public HrBaselineImportService(
            HrBaselineWorkbookParser parser,
            HrBaselineImportContract contract,
            HrBaselineImportPersistence persistence
    ) {
        this.parser = parser;
        this.contract = contract;
        this.persistence = persistence;
    }

    /**
     * Upload and parse happen before the short database transaction. The
     * workbook bytes are not persisted; only staging JSON and hashes are kept.
     */
    public HrImportBatchSummary uploadAndParse(String originalFileName, byte[] workbookBytes, HrImportActor actor) {
        HrParsedBaselineWorkbook parsed = parser.parse(workbookBytes);
        contract.verify(parsed);
        return persistence.stage(originalFileName, parsed, actor);
    }

    public HrImportBatchSummary validate(String batchId, HrImportActor actor) {
        return persistence.validate(batchId, actor);
    }

    public HrImportPreviewPage preview(String batchId, int page, int size) {
        return persistence.preview(batchId, page, size);
    }

    public HrImportBatchSummary confirm(
            String batchId,
            String confirmationKey,
            boolean acceptWarnings,
            HrImportActor actor
    ) {
        return persistence.confirm(batchId, confirmationKey, acceptWarnings, actor);
    }

    public HrImportBatchSummary rollback(String batchId, HrImportActor actor) {
        return persistence.rollback(batchId, actor);
    }

    public int purgeExpiredPayloads(HrImportActor actor) {
        return persistence.purgeExpiredPayloads(actor);
    }
}

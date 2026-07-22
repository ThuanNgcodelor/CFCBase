package com.booking.system.hr.importer;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class HrImportPayloadRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(HrImportPayloadRetentionJob.class);

    private final HrBaselineImportService importService;

    @Scheduled(
            cron = "${app.hr.import.payload-purge-cron:0 30 2 * * *}",
            zone = "UTC"
    )
    void purgeExpiredPayloads() {
        try {
            int purgedBatches = importService.purgeExpiredPayloads(HrImportActor.systemRetentionActor());
            if (purgedBatches > 0) {
                log.info("HR import retention purged payload for {} batch(es)", purgedBatches);
            }
        } catch (RuntimeException exception) {
            // No raw payload, identifiers or file content may appear in this log.
            log.error("HR import retention job failed: {}", exception.getClass().getSimpleName());
        }
    }
}

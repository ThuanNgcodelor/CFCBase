package com.booking.system.hr.service;

import com.booking.system.hr.importer.HrImportActor;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

@Component
@RequiredArgsConstructor
class HrSalaryEffectiveDateJob {
    private static final Logger log = LoggerFactory.getLogger(HrSalaryEffectiveDateJob.class);
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final HrSalaryRaiseService service;

    @Scheduled(cron = "${app.hr.salary-effective-cron:0 5 0 * * *}", zone = "Asia/Ho_Chi_Minh")
    void applyDueChanges() {
        try {
            int count = service.applyDueScheduled(LocalDate.now(BUSINESS_ZONE), HrImportActor.systemSalaryActor());
            if (count > 0) log.info("Applied {} scheduled HR salary change(s)", count);
        } catch (RuntimeException exception) {
            log.error("Scheduled HR salary application failed: {}", exception.getClass().getSimpleName());
        }
    }
}

package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrExcelTemplateVersion;

import java.util.Optional;

public interface HrExcelTemplateVersionRepository extends HrRepository<HrExcelTemplateVersion, String> {
    Optional<HrExcelTemplateVersion> findByTemplateKeyAndVersionCode(String templateKey, String versionCode);
}

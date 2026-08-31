package com.booking.system.hr.repository;

import com.booking.system.hr.entity.HrSystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HrSystemSettingRepository extends JpaRepository<HrSystemSetting, String> {

    Optional<HrSystemSetting> findBySettingKey(String settingKey);

    List<HrSystemSetting> findByCategory(String category);
}

package com.booking.system.hr.service;

import com.booking.system.hr.api.dto.HrOcrSettingsDto;
import com.booking.system.hr.entity.HrSystemSetting;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrSystemSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HrOcrServiceTest {

    @Mock
    private HrSystemSettingRepository systemSettingRepository;

    private HrOcrService ocrService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HrImportActor actor = new HrImportActor("USER:1", "Manager", "admin@cfc.vn");

    @BeforeEach
    void setUp() {
        ocrService = new HrOcrService(systemSettingRepository);
    }

    @Test
    void getSettingsReturnsMaskedKeysAndDefaults() {
        when(systemSettingRepository.findBySettingKey("ocr.provider"))
                .thenReturn(Optional.of(HrSystemSetting.builder().settingKey("ocr.provider").settingValue("GEMINI").build()));
        when(systemSettingRepository.findBySettingKey("ocr.gemini.apiKey"))
                .thenReturn(Optional.of(HrSystemSetting.builder().settingKey("ocr.gemini.apiKey").settingValue("AIzaSyDummySecretKey123456").build()));
        when(systemSettingRepository.findBySettingKey("ocr.gemini.model"))
                .thenReturn(Optional.of(HrSystemSetting.builder().settingKey("ocr.gemini.model").settingValue("gemini-1.5-flash").build()));
        when(systemSettingRepository.findBySettingKey("ocr.groq.apiKey"))
                .thenReturn(Optional.empty());
        when(systemSettingRepository.findBySettingKey("ocr.groq.model"))
                .thenReturn(Optional.empty());

        HrOcrSettingsDto settings = ocrService.getSettings();

        assertThat(settings.provider()).isEqualTo("GEMINI");
        assertThat(settings.geminiApiKey()).isEqualTo("AIza...3456");
        assertThat(settings.hasGeminiKey()).isTrue();
        assertThat(settings.hasGroqKey()).isFalse();
        assertThat(settings.geminiModel()).isEqualTo("gemini-1.5-flash");
        assertThat(settings.groqModel()).isEqualTo("llama-3.2-11b-vision-preview");
    }

    @Test
    void updateSettingsSavesNewValues() {
        when(systemSettingRepository.findBySettingKey(any())).thenReturn(Optional.empty());

        HrOcrSettingsDto request = new HrOcrSettingsDto(
                "GROQ",
                "AIzaSyNewGeminiKey9999",
                "gemini-2.0-flash",
                "gsk_GroqNewSecretKey8888",
                "llama-3.2-90b-vision-preview",
                false,
                false
        );

        ocrService.updateSettings(request, actor);

        verify(systemSettingRepository, atLeast(4)).save(any(HrSystemSetting.class));
    }
}

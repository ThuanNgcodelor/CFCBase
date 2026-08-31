package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrOcrProfileResult;
import com.booking.system.hr.api.dto.HrOcrSettingsDto;
import com.booking.system.hr.entity.HrSystemSetting;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrSystemSettingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
public class HrOcrService {

    private final HrSystemSettingRepository systemSettingRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${GEMINI_API_KEY:}")
    private String defaultGeminiApiKey;

    @Value("${GROQ_API_KEY:}")
    private String defaultGroqApiKey;

    private static final String PROMPT = """
            Bạn là trợ lý AI chuyên gia bóc tách dữ liệu hồ sơ nhân sự, căn cước công dân (CCCD/CMND), sơ yếu lý lịch và đơn xin việc tiếng Việt.
            Hãy phân tích toàn bộ các hình ảnh được gửi kèm (có thể gồm CCCD mặt trước, CCCD mặt sau, tờ khai sơ yếu lý lịch, đơn xin việc, bằng cấp) và trích xuất thành một đối tượng JSON duy nhất theo đúng cấu trúc sau:
            {
              "fullName": "HỌ VÀ TÊN (Chữ in hoa hoặc chữ chuẩn)",
              "gender": "MALE hoặc FEMALE hoặc UNKNOWN",
              "dateOfBirth": "YYYY-MM-DD",
              "ethnicity": "Dân tộc (ví dụ: Kinh)",
              "religion": "Tôn giáo (ví dụ: Không)",
              "birthPlaceOriginal": "Quê quán / Nơi sinh nguyên quán",
              "birthPlaceCurrent": "Nơi sinh",
              "educationLevel": "Trình độ học vấn (ví dụ: 12/12, Đại học, Cao đẳng, Trung cấp, 9/12...)",
              "major": "Chuyên ngành (nếu có)",
              "legacyIdentityNumber": "Số CMND 9 số cũ (nếu có)",
              "citizenIdentityNumber": "Số CCCD 12 số",
              "issuedDate": "YYYY-MM-DD (ngày cấp CCCD)",
              "issuedPlace": "Nơi cấp CCCD (ví dụ: Cục Cảnh sát quản lý hành chính về trật tự xã hội hoặc Công an tỉnh...)",
              "socialInsuranceNumber": "Số sổ BHXH (nếu có)",
              "healthInsuranceNumber": "Mã thẻ BHYT (nếu có)",
              "phone": "Số điện thoại liên hệ",
              "personalEmail": "Email cá nhân (nếu có)",
              "permanentAddress": "Địa chỉ thường trú đầy đủ",
              "currentAddress": "Địa chỉ hiện tại / Nơi ở hiện nay",
              "emergencyContactName": "Họ tên người liên hệ khẩn cấp",
              "emergencyContactPhone": "SĐT người liên hệ khẩn cấp",
              "emergencyContactRelation": "Quan hệ với người liên hệ khẩn cấp (Bố, Mẹ, Vợ, Chồng, Anh, Chị...)"
            }
            LƯU Ý QUAN TRỌNG:
            1. Trả về đúng định dạng JSON thuần túy, không dùng markdown ```json ... ```, không có văn bản giải thích nào khác.
            2. Nếu trường nào không tìm thấy trong ảnh, hãy để chuỗi rỗng "".
            3. Ngày tháng bắt buộc chuẩn hóa về YYYY-MM-DD (ví dụ ngày 12/04/1995 -> 1995-04-12).
            4. Giới tính Nam -> MALE, Nữ -> FEMALE.
            """;

    public HrOcrService(HrSystemSettingRepository systemSettingRepository) {
        this.systemSettingRepository = systemSettingRepository;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public HrOcrSettingsDto getSettings() {
        String provider = getSettingValue("ocr.provider", "GEMINI").toUpperCase();
        String geminiApiKey = getEffectiveKey("ocr.gemini.apiKey", defaultGeminiApiKey);
        String geminiModel = getSettingValue("ocr.gemini.model", "gemini-1.5-flash");
        String groqApiKey = getEffectiveKey("ocr.groq.apiKey", defaultGroqApiKey);
        String groqModel = getSettingValue("ocr.groq.model", "llama-3.2-11b-vision-preview");

        return new HrOcrSettingsDto(
                provider,
                maskKey(geminiApiKey),
                geminiModel,
                maskKey(groqApiKey),
                groqModel,
                !geminiApiKey.isBlank(),
                !groqApiKey.isBlank()
        );
    }

    @Transactional
    public HrOcrSettingsDto updateSettings(HrOcrSettingsDto request, HrImportActor actor) {
        if (request.provider() != null && !request.provider().isBlank()) {
            saveSetting("ocr.provider", request.provider().trim().toUpperCase(), "OCR", "Nhà cung cấp OCR", actor);
        }

        if (request.geminiApiKey() != null && !request.geminiApiKey().isBlank() && !request.geminiApiKey().contains("****")) {
            saveSetting("ocr.gemini.apiKey", request.geminiApiKey().trim(), "OCR", "Google Gemini API Key", actor);
        }

        if (request.geminiModel() != null && !request.geminiModel().isBlank()) {
            saveSetting("ocr.gemini.model", request.geminiModel().trim(), "OCR", "Google Gemini Model", actor);
        }

        if (request.groqApiKey() != null && !request.groqApiKey().isBlank() && !request.groqApiKey().contains("****")) {
            saveSetting("ocr.groq.apiKey", request.groqApiKey().trim(), "OCR", "Groq API Key", actor);
        }

        if (request.groqModel() != null && !request.groqModel().isBlank()) {
            saveSetting("ocr.groq.model", request.groqModel().trim(), "OCR", "Groq Model", actor);
        }

        return getSettings();
    }

    public HrOcrProfileResult extractProfile(List<MultipartFile> files, HrImportActor actor) {
        if (files == null || files.isEmpty()) {
            throw HrApiException.badRequest("OCR_NO_FILES", "Vui lòng chọn ít nhất một ảnh hồ sơ để quét.");
        }

        String provider = getSettingValue("ocr.provider", "GEMINI").toUpperCase();

        if ("GROQ".equals(provider)) {
            return extractWithGroq(files);
        } else {
            return extractWithGemini(files);
        }
    }

    private HrOcrProfileResult extractWithGemini(List<MultipartFile> files) {
        String apiKey = getEffectiveKey("ocr.gemini.apiKey", defaultGeminiApiKey);
        if (apiKey.isBlank()) {
            throw HrApiException.badRequest("OCR_KEY_MISSING", "Chưa cấu hình Google Gemini API Key. Vui lòng vào Cài đặt để thêm API Key (hoàn toàn miễn phí).");
        }

        String model = getSettingValue("ocr.gemini.model", "gemini-1.5-flash");
        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        try {
            List<Map<String, Object>> parts = new ArrayList<>();
            parts.add(Map.of("text", PROMPT));

            for (MultipartFile file : files) {
                if (file.isEmpty()) continue;
                String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
                String base64Data = Base64.getEncoder().encodeToString(file.getBytes());
                parts.add(Map.of("inlineData", Map.of("mimeType", mimeType, "data", base64Data)));
            }

            Map<String, Object> contents = Map.of("contents", List.of(Map.of("parts", parts)),
                    "generationConfig", Map.of("temperature", 0.1, "responseMimeType", "application/json"));

            String requestBody = objectMapper.writeValueAsString(contents);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(45))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Gemini OCR error: status={}, body={}", response.statusCode(), response.body());
                throw HrApiException.badRequest("OCR_GEMINI_ERROR", "Lỗi từ dịch vụ Google Gemini: " + response.body());
            }

            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode textNode = rootNode.at("/candidates/0/content/parts/0/text");
            if (textNode.isMissingNode() || textNode.asText().isBlank()) {
                throw HrApiException.badRequest("OCR_EMPTY_RESPONSE", "Google Gemini không trả về dữ liệu nhận diện.");
            }

            String jsonText = cleanJsonText(textNode.asText());
            return parseOcrResult(jsonText, "Google Gemini (" + model + ")");

        } catch (HrApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini OCR invocation failure", e);
            throw HrApiException.badRequest("OCR_FAILED", "Không thể trích xuất thông tin ảnh: " + e.getMessage());
        }
    }

    private HrOcrProfileResult extractWithGroq(List<MultipartFile> files) {
        String apiKey = getEffectiveKey("ocr.groq.apiKey", defaultGroqApiKey);
        if (apiKey.isBlank()) {
            throw HrApiException.badRequest("OCR_KEY_MISSING", "Chưa cấu hình Groq API Key. Vui lòng vào Cài đặt để thêm API Key.");
        }

        String model = getSettingValue("ocr.groq.model", "llama-3.2-11b-vision-preview");
        String endpoint = "https://api.groq.com/openai/v1/chat/completions";

        try {
            List<Map<String, Object>> contentList = new ArrayList<>();
            contentList.add(Map.of("type", "text", "text", PROMPT));

            for (MultipartFile file : files) {
                if (file.isEmpty()) continue;
                String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
                String base64Data = Base64.getEncoder().encodeToString(file.getBytes());
                String dataUrl = "data:" + mimeType + ";base64," + base64Data;
                contentList.add(Map.of("type", "image_url", "image_url", Map.of("url", dataUrl)));
            }

            Map<String, Object> message = Map.of("role", "user", "content", contentList);
            Map<String, Object> payload = Map.of(
                    "model", model,
                    "messages", List.of(message),
                    "temperature", 0.1,
                    "response_format", Map.of("type", "json_object")
            );

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .timeout(Duration.ofSeconds(45))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Groq OCR error: status={}, body={}", response.statusCode(), response.body());
                throw HrApiException.badRequest("OCR_GROQ_ERROR", "Lỗi từ dịch vụ Groq: " + response.body());
            }

            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode contentNode = rootNode.at("/choices/0/message/content");
            if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
                throw HrApiException.badRequest("OCR_EMPTY_RESPONSE", "Groq không trả về dữ liệu nhận diện.");
            }

            String jsonText = cleanJsonText(contentNode.asText());
            return parseOcrResult(jsonText, "Groq Cloud (" + model + ")");

        } catch (HrApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Groq OCR invocation failure", e);
            throw HrApiException.badRequest("OCR_FAILED", "Không thể trích xuất thông tin ảnh từ Groq: " + e.getMessage());
        }
    }

    private HrOcrProfileResult parseOcrResult(String jsonText, String providerUsed) {
        try {
            JsonNode node = objectMapper.readTree(jsonText);

            return new HrOcrProfileResult(
                    getString(node, "fullName"),
                    normalizeGender(getString(node, "gender")),
                    normalizeDate(getString(node, "dateOfBirth")),
                    getString(node, "ethnicity"),
                    getString(node, "religion"),
                    getString(node, "birthPlaceOriginal"),
                    getString(node, "birthPlaceCurrent"),
                    getString(node, "educationLevel"),
                    getString(node, "major"),
                    getString(node, "legacyIdentityNumber"),
                    getString(node, "citizenIdentityNumber"),
                    normalizeDate(getString(node, "issuedDate")),
                    getString(node, "issuedPlace"),
                    getString(node, "socialInsuranceNumber"),
                    getString(node, "healthInsuranceNumber"),
                    getString(node, "phone"),
                    getString(node, "personalEmail"),
                    getString(node, "permanentAddress"),
                    getString(node, "currentAddress"),
                    getString(node, "emergencyContactName"),
                    getString(node, "emergencyContactPhone"),
                    getString(node, "emergencyContactRelation"),
                    providerUsed,
                    jsonText
            );
        } catch (Exception e) {
            log.error("Failed to parse OCR JSON output: {}", jsonText, e);
            throw HrApiException.badRequest("OCR_PARSE_ERROR", "Dữ liệu AI trả về không đúng định dạng JSON: " + e.getMessage());
        }
    }

    private String getString(JsonNode node, String fieldName) {
        if (node.hasNonNull(fieldName)) {
            return node.get(fieldName).asText("").trim();
        }
        return "";
    }

    private String normalizeGender(String raw) {
        if (raw == null || raw.isBlank()) return "UNKNOWN";
        String upper = raw.trim().toUpperCase();
        if (upper.contains("NAM") || upper.equals("MALE") || upper.equals("M")) return "MALE";
        if (upper.contains("NỮ") || upper.contains("NU") || upper.equals("FEMALE") || upper.equals("F")) return "FEMALE";
        return "UNKNOWN";
    }

    private String normalizeDate(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String trimmed = raw.trim();
        if (trimmed.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return trimmed;
        }
        // Try dd/MM/yyyy
        try {
            if (trimmed.contains("/") || trimmed.contains("-")) {
                String[] parts = trimmed.split("[/-]");
                if (parts.length == 3) {
                    if (parts[0].length() <= 2 && parts[2].length() == 4) {
                        int day = Integer.parseInt(parts[0]);
                        int month = Integer.parseInt(parts[1]);
                        int year = Integer.parseInt(parts[2]);
                        return String.format("%04d-%02d-%02d", year, month, day);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return trimmed;
    }

    private String cleanJsonText(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7);
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3);
        }
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed.trim();
    }

    private String getSettingValue(String key, String defaultValue) {
        return systemSettingRepository.findBySettingKey(key)
                .map(HrSystemSetting::getSettingValue)
                .filter(val -> val != null && !val.isBlank())
                .orElse(defaultValue);
    }

    private String getEffectiveKey(String settingKey, String defaultEnvVal) {
        return systemSettingRepository.findBySettingKey(settingKey)
                .map(HrSystemSetting::getSettingValue)
                .filter(val -> val != null && !val.isBlank())
                .orElse(defaultEnvVal != null ? defaultEnvVal : "");
    }

    private void saveSetting(String key, String value, String category, String description, HrImportActor actor) {
        HrSystemSetting setting = systemSettingRepository.findBySettingKey(key)
                .orElseGet(() -> HrSystemSetting.builder()
                        .settingKey(key)
                        .category(category)
                        .description(description)
                        .build());
        setting.setSettingValue(value);
        setting.setCategory(category);
        if (description != null) setting.setDescription(description);
        setting.setUpdatedByActor(actor.subject());
        if (setting.getCreatedByActor() == null) {
            setting.setCreatedByActor(actor.subject());
        }
        systemSettingRepository.save(setting);
    }

    private String maskKey(String key) {
        if (key == null || key.isBlank()) return "";
        if (key.length() <= 8) return "********";
        return key.substring(0, 4) + "..." + key.substring(key.length() - 4);
    }
}

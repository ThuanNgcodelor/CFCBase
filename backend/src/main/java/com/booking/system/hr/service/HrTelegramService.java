package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrTelegramDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeTelegramBinding;
import com.booking.system.hr.entity.HrSystemSetting;
import com.booking.system.hr.entity.HrTelegramRegistration;
import com.booking.system.hr.enums.HrTelegramBindingStatus;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrEmployeeTelegramBindingRepository;
import com.booking.system.hr.repository.HrSystemSettingRepository;
import com.booking.system.hr.repository.HrTelegramRegistrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class HrTelegramService {

    private static final String SETTING_BOT_USERNAME = "telegram.bot.username";
    private static final String SETTING_ENABLED = "telegram.enabled";
    private static final int MAX_ATTEMPTS = 5;
    private static final List<HrTelegramRegistrationStatus> OPEN_STATUSES = List.of(
            HrTelegramRegistrationStatus.STARTED,
            HrTelegramRegistrationStatus.PHONE_RECEIVED,
            HrTelegramRegistrationStatus.CODE_RECEIVED
    );

    private final HrTelegramRegistrationRepository registrationRepository;
    private final HrEmployeeTelegramBindingRepository bindingRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrSystemSettingRepository settingRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final TelegramBotClient botClient;

    @Value("${cfc.telegram.bot-token:}")
    private String botToken;

    @Value("${cfc.telegram.webhook-secret:}")
    private String webhookSecret;

    @Transactional(readOnly = true)
    public HrTelegramDtos.SettingsResponse settings() {
        HrSystemSetting username = settingRepository.findBySettingKey(SETTING_BOT_USERNAME).orElse(null);
        HrSystemSetting enabled = settingRepository.findBySettingKey(SETTING_ENABLED).orElse(null);
        return new HrTelegramDtos.SettingsResponse(
                username == null ? "" : Objects.toString(username.getSettingValue(), ""),
                enabled != null && "true".equalsIgnoreCase(enabled.getSettingValue()),
                hasBotToken(),
                webhookSecret != null && !webhookSecret.isBlank(),
                username == null ? null : username.getUpdatedAt()
        );
    }

    @Transactional
    public HrTelegramDtos.SettingsResponse updateSettings(HrTelegramDtos.SettingsRequest request, HrImportActor actor) {
        String username = normalizeBotUsername(request == null ? null : request.botUsername());
        boolean enabled = request != null && Boolean.TRUE.equals(request.enabled());
        saveSetting(SETTING_BOT_USERNAME, username, "Username bot Telegram", actor);
        saveSetting(SETTING_ENABLED, Boolean.toString(enabled), "Bật tiếp nhận đăng ký Telegram", actor);
        audit(actor, "HR_TELEGRAM_SETTINGS_UPDATED", "HR_TELEGRAM", null,
                List.of("botUsername", "enabled"), Map.of("enabled", enabled));
        return settings();
    }

    @Transactional(readOnly = true)
    public Page<HrTelegramDtos.RegistrationResponse> registrations(String keyword,
                                                                    HrTelegramRegistrationStatus status,
                                                                    Pageable pageable) {
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        return registrationRepository.search(status, normalizedKeyword, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<HrTelegramDtos.EmployeeStatusResponse> employeeStatuses(String keyword, String status, Pageable pageable) {
        List<HrEmployee> employees = employeeRepository.findAllByEmploymentStatusOrderByEmployeeCode(HrEmploymentStatus.ACTIVE);
        List<String> employeeIds = employees.stream().map(HrEmployee::getId).toList();
        Map<String, HrEmployeeTelegramBinding> bindings = new HashMap<>();
        if (!employeeIds.isEmpty()) {
            bindingRepository.findAllByEmployeeIdIn(employeeIds).forEach(binding -> bindings.put(binding.getEmployee().getId(), binding));
        }
        Map<String, HrTelegramRegistration> latestRegistrations = new HashMap<>();
        if (!employeeIds.isEmpty()) {
            registrationRepository.findAllByEmployeeIdInOrderByCreatedAtDesc(employeeIds)
                    .forEach(registration -> latestRegistrations.putIfAbsent(registration.getEmployee().getId(), registration));
        }
        String needle = keyword == null || keyword.isBlank() ? null : keyword.trim().toLowerCase(Locale.ROOT);
        String requestedStatus = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        List<HrTelegramDtos.EmployeeStatusResponse> filtered = new ArrayList<>();
        for (HrEmployee employee : employees) {
            HrEmployeeTelegramBinding binding = bindings.get(employee.getId());
            HrTelegramRegistration registration = latestRegistrations.get(employee.getId());
            String resolvedStatus = binding != null && binding.getStatus() == HrTelegramBindingStatus.ACTIVE
                    ? HrTelegramRegistrationStatus.VERIFIED.name()
                    : registration != null ? registration.getStatus().name()
                    : binding != null ? HrTelegramRegistrationStatus.REVOKED.name()
                    : "NOT_REGISTERED";
            String phone = binding != null && binding.getPhoneNumber() != null ? binding.getPhoneNumber()
                    : registration == null ? null : registration.getPhoneNumber();
            String username = binding != null && binding.getTelegramUsername() != null ? binding.getTelegramUsername()
                    : registration == null ? null : registration.getTelegramUsername();
            if (requestedStatus != null && !requestedStatus.equals(resolvedStatus)) continue;
            if (needle != null && !containsIgnoreCase(employee.getEmployeeCode(), needle)
                    && !containsIgnoreCase(employee.getFullName(), needle)
                    && !containsIgnoreCase(phone, needle)
                    && !containsIgnoreCase(username, needle)) continue;
            filtered.add(new HrTelegramDtos.EmployeeStatusResponse(
                    employee.getId(), registration == null ? null : registration.getId(), employee.getEmployeeCode(), employee.getFullName(), phone,
                    binding != null && binding.getTelegramUserId() != null ? binding.getTelegramUserId()
                            : registration == null ? null : registration.getTelegramUserId(),
                    username, resolvedStatus,
                    binding != null && binding.getLinkedAt() != null ? binding.getLinkedAt()
                            : registration == null ? null : registration.getCreatedAt(),
                    registration == null ? null : registration.getReviewedAt(),
                    registration == null ? null : registration.getReviewedByActor(),
                    registration == null ? null : registration.getReviewNote()));
        }
        int from = (int) Math.min((long) pageable.getPageNumber() * pageable.getPageSize(), filtered.size());
        int to = Math.min(from + pageable.getPageSize(), filtered.size());
        return new PageImpl<>(filtered.subList(from, to), pageable, filtered.size());
    }

    private static boolean containsIgnoreCase(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    @Transactional(readOnly = true)
    public HrTelegramDtos.SummaryResponse summary() {
        return new HrTelegramDtos.SummaryResponse(
                registrationRepository.count(),
                registrationRepository.countByStatus(HrTelegramRegistrationStatus.PENDING_REVIEW),
                bindingRepository.countByStatus(HrTelegramBindingStatus.ACTIVE),
                registrationRepository.countByStatus(HrTelegramRegistrationStatus.REJECTED),
                bindingRepository.countByStatus(HrTelegramBindingStatus.REVOKED)
        );
    }

    @Transactional
    public void handleWebhook(String secret, Map<String, Object> update) {
        if (!secretsEqual(webhookSecret, secret)) {
            throw HrApiException.badRequest("TELEGRAM_WEBHOOK_SECRET_INVALID", "Webhook không hợp lệ.");
        }
        if (update == null) return;
        Object messageValue = update.get("message");
        if (!(messageValue instanceof Map<?, ?> message)) return;
        Map<?, ?> from = asMap(message.get("from"));
        Map<?, ?> chat = asMap(message.get("chat"));
        Long userId = longValue(from == null ? null : from.get("id"));
        Long chatId = longValue(chat == null ? null : chat.get("id"));
        if (userId == null || chatId == null || !"private".equals(String.valueOf(chat == null ? null : chat.get("type")))) {
            return;
        }
        Map<?, ?> contact = asMap(message.get("contact"));
        if (contact != null) {
            handleContact(userId, chatId, from, contact);
            return;
        }
        String text = message.get("text") == null ? "" : String.valueOf(message.get("text")).trim();
        if (text.equalsIgnoreCase("/start") || text.toLowerCase(Locale.ROOT).startsWith("/start ")) {
            startRegistration(userId, chatId, from);
            return;
        }
        handleEmployeeCode(userId, chatId, from, text);
    }

    @Transactional
    public HrTelegramDtos.RegistrationResponse verify(String registrationId, HrTelegramDtos.ReviewRequest request, HrImportActor actor) {
        HrTelegramRegistration registration = registrationRepository.findByIdForUpdate(registrationId)
                .orElseThrow(() -> HrApiException.notFound("TELEGRAM_REGISTRATION_NOT_FOUND", "Không tìm thấy đăng ký Telegram."));
        if (registration.getStatus() != HrTelegramRegistrationStatus.PENDING_REVIEW
                || registration.getEmployee() == null
                || registration.getTelegramUserId() == null
                || registration.getTelegramChatId() == null) {
            throw HrApiException.conflict("TELEGRAM_REGISTRATION_NOT_REVIEWABLE", "Đăng ký chưa đủ dữ liệu để xác minh.");
        }
        HrEmployee employee = employeeRepository.findDetailByIdForUpdate(registration.getEmployee().getId())
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân sự."));
        HrEmployeeTelegramBinding existingUser = bindingRepository.findActiveByTelegramUserId(
                registration.getTelegramUserId(), HrTelegramBindingStatus.ACTIVE).orElse(null);
        if (existingUser != null && !existingUser.getEmployee().getId().equals(employee.getId())) {
            throw HrApiException.conflict("TELEGRAM_ACCOUNT_ALREADY_BOUND", "Tài khoản Telegram đã liên kết với nhân sự khác.");
        }
        HrEmployeeTelegramBinding binding = bindingRepository.findByEmployeeIdForUpdate(employee.getId()).orElse(null);
        if (binding != null && binding.getStatus() == HrTelegramBindingStatus.ACTIVE
                && binding.getTelegramUserId() != null
                && !Objects.equals(binding.getTelegramUserId(), registration.getTelegramUserId())) {
            throw HrApiException.conflict("EMPLOYEE_ALREADY_HAS_TELEGRAM", "Nhân sự này đã được liên kết với một tài khoản Telegram khác.");
        }
        if (binding == null) {
            HrEmployeeTelegramBinding value = new HrEmployeeTelegramBinding();
            value.setEmployee(employee);
            value.setCreatedByActor(actor.subject());
            binding = value;
        }
        binding.setTelegramUserId(registration.getTelegramUserId());
        binding.setTelegramChatId(registration.getTelegramChatId());
        binding.setTelegramUsername(registration.getTelegramUsername());
        binding.setPhoneNumber(registration.getPhoneNumber());
        binding.setStatus(HrTelegramBindingStatus.ACTIVE);
        binding.setLinkedAt(now());
        binding.setRevokedAt(null);
        binding.setRevokedReason(null);
        binding.setUpdatedByActor(actor.subject());
        bindingRepository.save(binding);

        registration.setStatus(HrTelegramRegistrationStatus.VERIFIED);
        registration.setReviewedAt(now());
        registration.setReviewedByActor(actor.subject());
        registration.setReviewNote(request == null ? null : request.note());
        registration.setUpdatedByActor(actor.subject());
        registrationRepository.save(registration);
        audit(actor, "HR_TELEGRAM_REGISTRATION_VERIFIED", "HR_TELEGRAM_REGISTRATION", registration.getId(),
                List.of("status", "binding"), Map.of("employeeId", employee.getId()));
        return toResponse(registration);
    }

    @Transactional
    public HrTelegramDtos.RegistrationResponse reject(String registrationId, HrTelegramDtos.ReviewRequest request, HrImportActor actor) {
        HrTelegramRegistration registration = registrationRepository.findByIdForUpdate(registrationId)
                .orElseThrow(() -> HrApiException.notFound("TELEGRAM_REGISTRATION_NOT_FOUND", "Không tìm thấy đăng ký Telegram."));
        if (registration.getStatus() != HrTelegramRegistrationStatus.PENDING_REVIEW) {
            throw HrApiException.conflict("TELEGRAM_REGISTRATION_NOT_REVIEWABLE", "Đăng ký không còn chờ xác minh.");
        }
        registration.setStatus(HrTelegramRegistrationStatus.REJECTED);
        registration.setReviewedAt(now());
        registration.setReviewedByActor(actor.subject());
        registration.setReviewNote(request == null ? null : request.note());
        registration.setUpdatedByActor(actor.subject());
        registrationRepository.save(registration);
        audit(actor, "HR_TELEGRAM_REGISTRATION_REJECTED", "HR_TELEGRAM_REGISTRATION", registration.getId(),
                List.of("status", "reviewNote"), Map.of());
        return toResponse(registration);
    }

    @Transactional
    public void revoke(String employeeId, HrTelegramDtos.ReviewRequest request, HrImportActor actor) {
        HrEmployeeTelegramBinding binding = bindingRepository.findByEmployeeIdForUpdate(employeeId)
                .orElseThrow(() -> HrApiException.notFound("TELEGRAM_BINDING_NOT_FOUND", "Nhân sự chưa có liên kết Telegram."));
        binding.setStatus(HrTelegramBindingStatus.REVOKED);
        binding.setRevokedAt(now());
        binding.setRevokedReason(request == null ? null : request.note());
        binding.setUpdatedByActor(actor.subject());
        bindingRepository.save(binding);
        audit(actor, "HR_TELEGRAM_BINDING_REVOKED", "HR_TELEGRAM_BINDING", binding.getId(),
                List.of("status", "revokedReason"), Map.of("employeeId", employeeId));
    }

    public String commonBotLink() {
        String username = settings().botUsername();
        if (username.isBlank()) return "";
        return "https://t.me/" + username + "?start=register";
    }

    public String webhookSecret() {
        return webhookSecret;
    }

    public boolean isWebhookSecretValid(String candidate) {
        return secretsEqual(webhookSecret, candidate);
    }

    private void startRegistration(Long userId, Long chatId, Map<?, ?> from) {
        if (!settings().enabled()) {
            botClient.sendText(chatId, "Hiện hệ thống chưa mở đăng ký Telegram. Vui lòng liên hệ nhân sự.");
            return;
        }
        HrEmployeeTelegramBinding binding = bindingRepository.findActiveByTelegramUserId(userId, HrTelegramBindingStatus.ACTIVE).orElse(null);
        if (binding != null) {
            botClient.sendText(chatId, "Tài khoản Telegram này đã được liên kết. Nếu cần thay đổi, vui lòng liên hệ nhân sự.");
            return;
        }
        HrTelegramRegistration latest = registrationRepository.findTopByTelegramUserIdOrderByCreatedAtDesc(userId).orElse(null);
        if (latest != null && latest.getStatus() == HrTelegramRegistrationStatus.BLOCKED) {
            botClient.sendText(chatId, "Tài khoản đang tạm khóa do nhập sai nhiều lần. Vui lòng liên hệ nhân sự để mở lại.");
            return;
        }
        HrTelegramRegistration registration = registrationRepository
                .findTopByTelegramUserIdAndStatusInOrderByCreatedAtDesc(userId, OPEN_STATUSES).orElse(null);
        if (registration == null) {
            registration = new HrTelegramRegistration();
            registration.setTelegramUserId(userId);
            registration.setTelegramChatId(chatId);
            registration.setStatus(HrTelegramRegistrationStatus.STARTED);
            registration.setAttemptCount(0);
            registration.setCreatedByActor("TELEGRAM:" + userId);
        } else {
            registration.setStatus(HrTelegramRegistrationStatus.STARTED);
            registration.setTelegramChatId(chatId);
        }
        registration.setTelegramUsername(from == null ? null : textValue(from.get("username")));
        registration.setUpdatedByActor("TELEGRAM:" + userId);
        registrationRepository.save(registration);
        botClient.sendContactRequest(chatId);
    }

    private void handleContact(Long userId, Long chatId, Map<?, ?> from, Map<?, ?> contact) {
        Long contactUserId = longValue(contact.get("user_id"));
        if (contactUserId != null && !contactUserId.equals(userId)) {
            botClient.sendText(chatId, "Vui lòng dùng nút Chia sẻ số điện thoại của chính tài khoản này.");
            return;
        }
        HrTelegramRegistration registration = currentRegistration(userId);
        if (registration == null) {
            botClient.sendText(chatId, "Vui lòng bấm /start để bắt đầu đăng ký.");
            return;
        }
        registration.setPhoneNumber(normalizePhone(textValue(contact.get("phone_number"))));
        registration.setTelegramUsername(from == null ? registration.getTelegramUsername() : textValue(from.get("username")));
        registration.setStatus(HrTelegramRegistrationStatus.PHONE_RECEIVED);
        registration.setUpdatedByActor("TELEGRAM:" + userId);
        registrationRepository.save(registration);
        botClient.sendText(chatId, "Đã nhận số điện thoại. Vui lòng nhập Mã nhân viên của bạn, ví dụ: B092.");
    }

    private void handleEmployeeCode(Long userId, Long chatId, Map<?, ?> from, String text) {
        if (text.isBlank() || text.startsWith("/")) return;
        HrTelegramRegistration registration = currentRegistration(userId);
        if (registration == null || registration.getPhoneNumber() == null) {
            botClient.sendText(chatId, "Vui lòng bấm /start và chia sẻ số điện thoại trước.");
            return;
        }
        int attempts = registration.getAttemptCount() + 1;
        registration.setAttemptCount(attempts);
        registration.setLastAttemptAt(now());
        String code = normalizeEmployeeCode(text);
        HrEmployee employee = employeeRepository.findByEmployeeCode(code).orElse(null);
        if (employee == null) {
            registration.setStatus(attempts >= MAX_ATTEMPTS ? HrTelegramRegistrationStatus.BLOCKED : HrTelegramRegistrationStatus.PHONE_RECEIVED);
            registration.setUpdatedByActor("TELEGRAM:" + userId);
            registrationRepository.save(registration);
            botClient.sendText(chatId, attempts >= MAX_ATTEMPTS
                    ? "Bạn đã nhập sai quá số lần cho phép. Vui lòng liên hệ nhân sự."
                    : "Mã nhân viên chưa đúng. Vui lòng nhập lại.");
            return;
        }
        HrEmployeeTelegramBinding active = bindingRepository.findActiveByTelegramUserId(userId, HrTelegramBindingStatus.ACTIVE).orElse(null);
        if (active != null && !active.getEmployee().getId().equals(employee.getId())) {
            registration.setStatus(HrTelegramRegistrationStatus.BLOCKED);
            registration.setUpdatedByActor("TELEGRAM:" + userId);
            registrationRepository.save(registration);
            botClient.sendText(chatId, "Tài khoản này đã được liên kết với hồ sơ khác. Vui lòng liên hệ nhân sự.");
            return;
        }
        registration.setEmployee(employee);
        registration.setEnteredEmployeeCode(code);
        registration.setStatus(HrTelegramRegistrationStatus.PENDING_REVIEW);
        registration.setTelegramUsername(from == null ? registration.getTelegramUsername() : textValue(from.get("username")));
        registration.setUpdatedByActor("TELEGRAM:" + userId);
        registrationRepository.save(registration);
        botClient.sendText(chatId, "Đã tiếp nhận đăng ký. Bộ phận nhân sự sẽ kiểm tra và xác nhận trước khi gửi phiếu lương.");
    }

    private HrTelegramRegistration currentRegistration(Long userId) {
        return registrationRepository.findTopByTelegramUserIdAndStatusInOrderByCreatedAtDesc(userId, OPEN_STATUSES).orElse(null);
    }

    private HrTelegramDtos.RegistrationResponse toResponse(HrTelegramRegistration registration) {
        HrEmployee employee = registration.getEmployee();
        return new HrTelegramDtos.RegistrationResponse(
                registration.getId(), employee == null ? null : employee.getId(),
                employee == null ? registration.getEnteredEmployeeCode() : employee.getEmployeeCode(),
                employee == null ? null : employee.getFullName(), registration.getPhoneNumber(),
                registration.getTelegramUserId(), registration.getTelegramChatId(), registration.getTelegramUsername(),
                registration.getStatus(), registration.getAttemptCount(), registration.getCreatedAt(),
                registration.getReviewedAt(), registration.getReviewedByActor(), registration.getReviewNote()
        );
    }

    private void saveSetting(String key, String value, String description, HrImportActor actor) {
        HrSystemSetting setting = settingRepository.findBySettingKey(key).orElseGet(HrSystemSetting::new);
        setting.setSettingKey(key);
        setting.setSettingValue(value);
        setting.setCategory("TELEGRAM");
        setting.setDescription(description);
        setting.setUpdatedByActor(actor.subject());
        if (setting.getCreatedByActor() == null) setting.setCreatedByActor(actor.subject());
        settingRepository.save(setting);
    }

    private void audit(HrImportActor actor, String action, String entityType, String entityId,
                       List<String> fields, Map<String, ?> metadata) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(entityType);
        event.setEntityId(entityId);
        try {
            event.setChangedFields(jsonCodec.write(fields));
            event.setSanitizedMetadata(jsonCodec.write(metadata));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể ghi audit Telegram.", exception);
        }
        auditRepository.save(event);
    }

    private static LocalDateTime now() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    private static boolean secretsEqual(String expected, String actual) {
        if (expected == null || expected.isBlank() || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private boolean hasBotToken() {
        return botToken != null && !botToken.isBlank();
    }

    private static String normalizeBotUsername(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.startsWith("@")) normalized = normalized.substring(1);
        return normalized;
    }

    private static String normalizeEmployeeCode(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizePhone(String value) {
        if (value == null) return null;
        String digits = value.replaceAll("[^0-9+]", "");
        if (digits.startsWith("+84")) digits = "0" + digits.substring(3);
        return digits.isBlank() ? null : digits;
    }

    private static Map<?, ?> asMap(Object value) {
        return value instanceof Map<?, ?> map ? map : null;
    }

    private static Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try { return value == null ? null : Long.valueOf(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private static String textValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}

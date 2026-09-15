package com.booking.system.hr.service;

import com.booking.system.entity.User;
import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPayrollDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrPayrollImportRow;
import com.booking.system.hr.entity.HrPayrollTestDelivery;
import com.booking.system.hr.entity.HrPayrollTestRecipient;
import com.booking.system.hr.entity.HrSystemSetting;
import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HrPayrollTestRecipientService {
    private static final String ACTIVE = "ACTIVE";
    private static final String PENDING = "PENDING";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HrPayrollTestRecipientRepository recipientRepository;
    private final HrPayrollTestDeliveryRepository testDeliveryRepository;
    private final HrPayrollImportRowRepository rowRepository;
    private final HrSystemSettingRepository settingRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final TelegramBotClient botClient;

    @Transactional(readOnly = true)
    public HrPayrollDtos.TestRecipientResponse current(User user) {
        requireUser(user);
        return recipientRepository.findByUserId(user.getId()).map(this::toResponse)
                .orElse(new HrPayrollDtos.TestRecipientResponse(null, "NOT_LINKED", null, null, null, null, null));
    }

    @Transactional
    public HrPayrollDtos.TestRecipientResponse createLink(User user, HrImportActor actor) {
        requireUser(user);
        String username = settingRepository.findBySettingKey("telegram.bot.username")
                .map(HrSystemSetting::getSettingValue).orElse("").replace("@", "").trim();
        if (username.isBlank()) throw HrApiException.conflict("TELEGRAM_BOT_USERNAME_MISSING", "Hãy cấu hình username bot trước khi liên kết tài khoản nhận thử.");
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        HrPayrollTestRecipient recipient = recipientRepository.findByUserId(user.getId()).orElseGet(HrPayrollTestRecipient::new);
        if (recipient.getCreatedByActor() == null) recipient.setCreatedByActor(actor.subject());
        recipient.setUserId(user.getId());
        recipient.setStatus(PENDING);
        recipient.setLinkTokenHash(hash(token));
        recipient.setLinkExpiresAt(now().plusMinutes(15));
        recipient.setTelegramUserId(null);
        recipient.setTelegramChatId(null);
        recipient.setTelegramUsername(null);
        recipient.setLinkedAt(null);
        recipient.setUpdatedByActor(actor.subject());
        recipientRepository.save(recipient);
        audit(actor, "HR_PAYROLL_TEST_LINK_CREATED", "HR_PAYROLL_TEST_RECIPIENT", recipient.getId(), Map.of());
        HrPayrollDtos.TestRecipientResponse response = toResponse(recipient);
        return new HrPayrollDtos.TestRecipientResponse(response.id(), response.status(), response.telegramUsername(),
                response.telegramUserId(), response.linkedAt(), "https://t.me/" + username + "?start=paytest_" + token,
                recipient.getLinkExpiresAt());
    }

    @Transactional
    public boolean handleStartToken(String token, Long telegramUserId, Long chatId, String username) {
        if (token == null || token.isBlank()) return false;
        HrPayrollTestRecipient recipient = recipientRepository.findByLinkTokenHashAndStatus(hash(token), PENDING).orElse(null);
        if (recipient == null || recipient.getLinkExpiresAt() == null || recipient.getLinkExpiresAt().isBefore(now())) {
            botClient.sendText(chatId, "Liên kết nhận thử không hợp lệ hoặc đã hết hạn. Vui lòng tạo lại liên kết trên CFCBase.");
            return true;
        }
        recipient.setStatus(ACTIVE);
        recipient.setTelegramUserId(telegramUserId);
        recipient.setTelegramChatId(chatId);
        recipient.setTelegramUsername(username);
        recipient.setLinkedAt(now());
        recipient.setLinkTokenHash(null);
        recipient.setLinkExpiresAt(null);
        recipient.setUpdatedByActor("TELEGRAM:" + telegramUserId);
        recipientRepository.save(recipient);
        botClient.sendText(chatId, "Đã liên kết tài khoản này làm nơi nhận thử phiếu lương CFCBase. Tin gửi thử sẽ có nhãn BẢN TEST.");
        return true;
    }

    @Transactional
    public void revoke(User user, HrImportActor actor) {
        requireUser(user);
        HrPayrollTestRecipient recipient = recipientRepository.findByUserId(user.getId())
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_TEST_RECIPIENT_NOT_FOUND", "Chưa liên kết tài khoản nhận thử."));
        recipient.setStatus("REVOKED");
        recipient.setTelegramChatId(null);
        recipient.setTelegramUserId(null);
        recipient.setLinkTokenHash(null);
        recipient.setLinkExpiresAt(null);
        recipient.setUpdatedByActor(actor.subject());
        recipientRepository.save(recipient);
        audit(actor, "HR_PAYROLL_TEST_LINK_REVOKED", "HR_PAYROLL_TEST_RECIPIENT", recipient.getId(), Map.of());
    }

    @Transactional
    public HrPayrollDtos.TestDeliveryResponse sendTest(String importId, String rowId, User user, HrImportActor actor) {
        requireUser(user);
        HrPayrollTestRecipient recipient = recipientRepository.findByUserId(user.getId())
                .filter(value -> ACTIVE.equals(value.getStatus()) && value.getTelegramChatId() != null)
                .orElseThrow(() -> HrApiException.conflict("PAYROLL_TEST_RECIPIENT_NOT_LINKED", "Hãy liên kết tài khoản Telegram nhận thử trước."));
        HrPayrollImportRow row = rowRepository.findByIdAndPayrollImportId(rowId, importId)
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_ROW_NOT_FOUND", "Không tìm thấy dòng lương trong file này."));
        String message = "⚠️ BẢN GỬI THỬ - KHÔNG PHẢI PHIẾU LƯƠNG CHÍNH THỨC\n"
                + "Dữ liệu nguồn: " + row.getEmployeeCode() + " - " + row.getEmployeeName() + "\n\n"
                + HrPayrollMessageRenderer.render(row, row.getPayrollImport().getPayrollMonth());
        HrPayrollTestDelivery delivery = new HrPayrollTestDelivery();
        delivery.setImportRow(row);
        delivery.setTestRecipient(recipient);
        delivery.setEmployeeCode(row.getEmployeeCode());
        delivery.setEmployeeName(row.getEmployeeName());
        delivery.setMessageSnapshot(message);
        delivery.setStatus(HrPayrollDeliveryStatus.SENDING);
        delivery.setCreatedByActor(actor.subject());
        delivery.setUpdatedByActor(actor.subject());
        delivery = testDeliveryRepository.save(delivery);
        TelegramBotClient.PayrollSendResult result = botClient.sendPayrollText(recipient.getTelegramChatId(), message);
        delivery.setStatus(result.sent() ? HrPayrollDeliveryStatus.SENT : HrPayrollDeliveryStatus.FAILED);
        delivery.setLastError(result.error());
        if (result.sent()) delivery.setSentAt(now());
        delivery.setUpdatedByActor(actor.subject());
        testDeliveryRepository.save(delivery);
        audit(actor, "HR_PAYROLL_TEST_SENT", "HR_PAYROLL_TEST_DELIVERY", delivery.getId(),
                Map.of("employeeCode", row.getEmployeeCode(), "sent", result.sent()));
        return new HrPayrollDtos.TestDeliveryResponse(delivery.getId(), row.getEmployeeCode(), row.getEmployeeName(),
                delivery.getStatus(), delivery.getLastError(), delivery.getSentAt());
    }

    private HrPayrollDtos.TestRecipientResponse toResponse(HrPayrollTestRecipient value) {
        return new HrPayrollDtos.TestRecipientResponse(value.getId(), value.getStatus(), value.getTelegramUsername(),
                null, value.getLinkedAt(), null, value.getLinkExpiresAt());
    }

    private void audit(HrImportActor actor, String action, String type, String id, Map<String, ?> metadata) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject()); event.setActorDisplayName(actor.displayName()); event.setActorRole(actor.role());
        event.setAction(action); event.setEntityType(type); event.setEntityId(id);
        try {
            event.setChangedFields(jsonCodec.write(List.of("status")));
            event.setSanitizedMetadata(jsonCodec.write(metadata));
        } catch (Exception exception) { throw new IllegalStateException("Không thể ghi audit gửi thử.", exception); }
        auditRepository.save(event);
    }

    private static void requireUser(User user) {
        if (user == null || user.getId() == null) throw HrApiException.badRequest("AUTH_REQUIRED", "Phiên đăng nhập không hợp lệ.");
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) { throw new IllegalStateException("Không thể tạo liên kết an toàn.", exception); }
    }

    private static LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
}

package com.booking.system.hr.api;

import com.booking.system.hr.service.HrTelegramService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@RestController
@Slf4j
@RequestMapping("/api/v1/integrations/telegram/payroll")
public class TelegramWebhookController {

    private final HrTelegramService service;

    public TelegramWebhookController(HrTelegramService service) {
        this.service = service;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @RequestHeader(value = "X-Telegram-Bot-Api-Secret-Token", required = false) String secret,
            @RequestBody Map<String, Object> update) {
        log.info("Telegram webhook received: updateId={}, messagePresent={}, secretPresent={}",
                update == null ? null : update.get("update_id"),
                update != null && update.containsKey("message"),
                secret != null && !secret.isBlank());
        if (!service.isWebhookSecretValid(secret)) {
            log.warn("Telegram webhook rejected: secret validation failed");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        service.handleWebhook(secret, update);
        return ResponseEntity.ok().build();
    }
}

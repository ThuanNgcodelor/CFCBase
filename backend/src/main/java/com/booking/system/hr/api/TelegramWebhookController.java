package com.booking.system.hr.api;

import com.booking.system.hr.service.HrTelegramService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
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
        if (!service.isWebhookSecretValid(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        service.handleWebhook(secret, update);
        return ResponseEntity.ok().build();
    }
}

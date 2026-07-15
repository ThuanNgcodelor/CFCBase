package com.booking.system.service;

import com.booking.system.entity.PushSubscription;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Urgency;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.security.GeneralSecurityException;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushService {

    private final nl.martijndwars.webpush.PushService webPushClient;
    private final PushSubscriptionService pushSubscriptionService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.webpush.public-key:}")
    private String publicKey;

    @Value("${app.webpush.private-key:}")
    private String privateKey;

    @Value("${app.webpush.retry.max-attempts:3}")
    private int maxAttempts;

    @Value("${app.webpush.retry.backoff-ms:250}")
    private long retryBackoffMillis;

    public String getVapidPublicKey() {
        return publicKey == null ? "" : publicKey;
    }

    public void sendPush(PushSubscription subscription, Object payload) {
        if (!isConfigured()) {
            log.debug("Web Push is not configured; skipping subscription {}", subscription.getId());
            return;
        }

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            log.error("Failed to serialize Web Push payload for subscription {}", subscription.getId(), ex);
            return;
        }

        Notification notification;
        try {
            notification = Notification.builder()
                    .endpoint(subscription.getEndpoint())
                    .userPublicKey(subscription.getP256dhKey())
                    .userAuth(subscription.getAuthKey())
                    .payload(jsonPayload)
                    .ttl(24 * 60 * 60)
                    .urgency(Urgency.HIGH)
                    .build();
        } catch (Exception ex) {
            log.error("Failed to build Web Push notification for subscription {}", subscription.getId(), ex);
            return;
        }

        int attempts = Math.max(1, maxAttempts);
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                // Dùng AES128GCM (RFC 8291) thay vì AESGCM legacy mặc định.
                // AES128GCM được iOS Safari 16.4+ hỗ trợ và là encoding chuẩn hiện đại.
                var response = webPushClient.send(notification, Encoding.AES128GCM);
                int statusCode = response.getStatusLine().getStatusCode();

                if (handleStatus(subscription, statusCode)) {
                    return;
                }

                if (isRetryableStatus(statusCode) && attempt < attempts) {
                    backoffBeforeRetry(subscription, attempt, attempts, "status " + statusCode);
                    continue;
                }

                log.warn("Push send returned status {} for subscription {} after {} attempt(s)",
                        statusCode, subscription.getId(), attempt);
                return;

            } catch (GeneralSecurityException ex) {
                // Lỗi crypto cố định (InvalidKeyException, NoSuchAlgorithmException, v.v.)
                // Retry không có tác dụng — log error ngay và dừng.
                log.error("Permanent crypto error sending Web Push to subscription {} — will not retry: {}",
                        subscription.getId(), ex.getMessage(), ex);
                return;

            } catch (IOException ex) {
                // Lỗi I/O tạm thời — có thể retry.
                if (attempt < attempts) {
                    backoffBeforeRetry(subscription, attempt, attempts, ex.getClass().getSimpleName());
                    continue;
                }
                log.error("Failed to send Web Push to subscription {} after {} attempt(s) (IOException)",
                        subscription.getId(), attempt, ex);

            } catch (Exception ex) {
                // Exception không xác định — retry một lần, sau đó log và dừng.
                if (attempt < attempts) {
                    backoffBeforeRetry(subscription, attempt, attempts, ex.getClass().getSimpleName());
                    continue;
                }
                log.error("Failed to send Web Push to subscription {} after {} attempt(s)",
                        subscription.getId(), attempt, ex);
            }
        }
    }

    private boolean handleStatus(PushSubscription subscription, int statusCode) {
        if (statusCode >= 200 && statusCode < 300) {
            pushSubscriptionService.markSendSuccess(subscription.getId());
            return true;
        }
        if (statusCode == 404 || statusCode == 410 || statusCode == 403) {
            pushSubscriptionService.deactivate(subscription.getId());
            log.info("Push subscription {} deactivated after status {}", subscription.getId(), statusCode);
            return true;
        }
        if (statusCode == 413) {
            log.warn("Push payload too large for subscription {}", subscription.getId());
            return true;
        }

        return false;
    }

    private boolean isRetryableStatus(int statusCode) {
        return statusCode == 408 || statusCode == 429 || statusCode >= 500;
    }

    private void backoffBeforeRetry(PushSubscription subscription, int attempt, int attempts, String reason) {
        log.warn("Retrying Web Push for subscription {} after {} (attempt {}/{})",
                subscription.getId(), reason, attempt + 1, attempts);

        if (retryBackoffMillis <= 0) {
            return;
        }

        try {
            Thread.sleep(retryBackoffMillis);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean isConfigured() {
        return StringUtils.hasText(publicKey) && StringUtils.hasText(privateKey);
    }
}

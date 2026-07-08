package com.booking.system.service;

import com.booking.system.entity.PushSubscription;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Urgency;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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

    public String getVapidPublicKey() {
        return publicKey == null ? "" : publicKey;
    }

    public void sendPush(PushSubscription subscription, Object payload) {
        if (!isConfigured()) {
            log.debug("Web Push is not configured; skipping subscription {}", subscription.getId());
            return;
        }

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            Notification notification = Notification.builder()
                    .endpoint(subscription.getEndpoint())
                    .userPublicKey(subscription.getP256dhKey())
                    .userAuth(subscription.getAuthKey())
                    .payload(jsonPayload)
                    .ttl(24 * 60 * 60)
                    .urgency(Urgency.HIGH)
                    .build();

            var response = webPushClient.send(notification);
            int statusCode = response.getStatusLine().getStatusCode();
            if (statusCode >= 200 && statusCode < 300) {
                pushSubscriptionService.markSendSuccess(subscription.getId());
                return;
            }
            if (statusCode == 404 || statusCode == 410 || statusCode == 403) {
                pushSubscriptionService.deactivate(subscription.getId());
                log.info("Push subscription {} deactivated after status {}", subscription.getId(), statusCode);
                return;
            }
            if (statusCode == 413) {
                log.warn("Push payload too large for subscription {}", subscription.getId());
                return;
            }
            log.warn("Push send returned status {} for subscription {}", statusCode, subscription.getId());
        } catch (Exception ex) {
            log.error("Failed to send Web Push to subscription {}", subscription.getId(), ex);
        }
    }

    private boolean isConfigured() {
        return StringUtils.hasText(publicKey) && StringUtils.hasText(privateKey);
    }
}

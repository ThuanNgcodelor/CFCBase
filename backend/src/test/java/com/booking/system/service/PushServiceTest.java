package com.booking.system.service;

import com.booking.system.entity.PushSubscription;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import org.apache.http.HttpResponse;
import org.apache.http.HttpVersion;
import org.apache.http.message.BasicHttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigInteger;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PushServiceTest {

    @Mock
    private nl.martijndwars.webpush.PushService webPushClient;

    @Mock
    private PushSubscriptionService pushSubscriptionService;

    @InjectMocks
    private PushService pushService;

    @BeforeEach
    void setUp() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        ReflectionTestUtils.setField(pushService, "publicKey", "public-key");
        ReflectionTestUtils.setField(pushService, "privateKey", "private-key");
        ReflectionTestUtils.setField(pushService, "maxAttempts", 3);
        ReflectionTestUtils.setField(pushService, "retryBackoffMillis", 0L);
    }

    @Test
    void retriesNetworkErrorThenMarksSuccess() throws Exception {
        PushSubscription subscription = subscription();
        when(webPushClient.send(any(Notification.class), any(Encoding.class)))
                .thenThrow(new IOException("network"))
                .thenReturn(response(201));

        pushService.sendPush(subscription, Map.of("title", "Hello"));

        verify(webPushClient, times(2)).send(any(Notification.class), any(Encoding.class));
        verify(pushSubscriptionService).markSendSuccess(subscription.getId());
        verify(pushSubscriptionService, never()).deactivate(subscription.getId());
    }

    @Test
    void retriesServerErrorWithLimit() throws Exception {
        PushSubscription subscription = subscription();
        when(webPushClient.send(any(Notification.class), any(Encoding.class)))
                .thenReturn(response(500))
                .thenReturn(response(502))
                .thenReturn(response(503));

        pushService.sendPush(subscription, Map.of("title", "Hello"));

        verify(webPushClient, times(3)).send(any(Notification.class), any(Encoding.class));
        verify(pushSubscriptionService, never()).markSendSuccess(subscription.getId());
        verify(pushSubscriptionService, never()).deactivate(subscription.getId());
    }

    @Test
    void doesNotRetryGoneSubscriptionAndDeactivates() throws Exception {
        PushSubscription subscription = subscription();
        when(webPushClient.send(any(Notification.class), any(Encoding.class))).thenReturn(response(410));

        pushService.sendPush(subscription, Map.of("title", "Hello"));

        verify(webPushClient, times(1)).send(any(Notification.class), any(Encoding.class));
        verify(pushSubscriptionService).deactivate(subscription.getId());
        verify(pushSubscriptionService, never()).markSendSuccess(subscription.getId());
    }

    private PushSubscription subscription() throws Exception {
        PushSubscription subscription = new PushSubscription();
        subscription.setId("push-sub-1");
        subscription.setEndpoint("https://push.example.test/subscription");
        subscription.setP256dhKey(validP256dhKey());
        subscription.setAuthKey(Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]));
        return subscription;
    }

    private HttpResponse response(int statusCode) {
        return new BasicHttpResponse(HttpVersion.HTTP_1_1, statusCode, "");
    }

    private String validP256dhKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        ECPublicKey publicKey = (ECPublicKey) generator.generateKeyPair().getPublic();

        byte[] x = toFixedLength(publicKey.getW().getAffineX(), 32);
        byte[] y = toFixedLength(publicKey.getW().getAffineY(), 32);
        byte[] uncompressed = new byte[65];
        uncompressed[0] = 0x04;
        System.arraycopy(x, 0, uncompressed, 1, x.length);
        System.arraycopy(y, 0, uncompressed, 33, y.length);

        return Base64.getUrlEncoder().withoutPadding().encodeToString(uncompressed);
    }

    private byte[] toFixedLength(BigInteger value, int length) {
        byte[] raw = value.toByteArray();
        byte[] result = new byte[length];
        int copyLength = Math.min(raw.length, length);
        System.arraycopy(raw, raw.length - copyLength, result, length - copyLength, copyLength);
        return result;
    }
}

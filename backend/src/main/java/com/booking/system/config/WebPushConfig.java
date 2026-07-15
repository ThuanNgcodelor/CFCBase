package com.booking.system.config;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.security.GeneralSecurityException;
import java.security.Security;

@Slf4j
@Configuration
public class WebPushConfig {

    @Bean
    public nl.martijndwars.webpush.PushService webPushClient(
            @Value("${app.webpush.public-key:}") String publicKey,
            @Value("${app.webpush.private-key:}") String privateKey,
            @Value("${app.webpush.subject:https://cfcbooking.io.vn}") String subject)
            throws GeneralSecurityException {
        ensureBouncyCastleProvider();
        if (StringUtils.hasText(publicKey) && StringUtils.hasText(privateKey)) {
            return new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject);
        }
        return new nl.martijndwars.webpush.PushService();
    }

    /**
     * Đảm bảo Bouncy Castle được đặt ở slot ưu tiên cao trong JCA provider list.
     *
     * Lý do dùng insertProviderAt(bc, 1) thay addProvider:
     *   - web-push 5.1.2 tạo EC key pair bằng Bouncy Castle.
     *   - Nếu JVM resolve KeyAgreement("ECDH") về SunEC, SunEC không xử lý được
     *     private key từ BC → InvalidKeyException: Not an EC key: ECDH.
     *   - insertProviderAt(bc, 1) đặt BC vào đầu danh sách, JVM ưu tiên BC
     *     khi resolve ECDH, tránh provider mismatch.
     *   - Thực hiện trong @Bean method (không phải main()) để an toàn với
     *     Spring Boot executable JAR bootstrap.
     */
    private void ensureBouncyCastleProvider() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            int position = Security.insertProviderAt(new BouncyCastleProvider(), 1);
            log.info("Bouncy Castle JCE provider registered at position {}", position);
        } else {
            log.debug("Bouncy Castle JCE provider already registered (position {})",
                    Security.getProviders() != null
                            ? java.util.Arrays.asList(Security.getProviders())
                                    .indexOf(Security.getProvider(BouncyCastleProvider.PROVIDER_NAME)) + 1
                            : "unknown");
        }
    }
}


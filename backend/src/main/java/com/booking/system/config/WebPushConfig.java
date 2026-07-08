package com.booking.system.config;

import org.springframework.beans.factory.annotation.Value;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.security.GeneralSecurityException;
import java.security.Security;

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

    private void ensureBouncyCastleProvider() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }
}

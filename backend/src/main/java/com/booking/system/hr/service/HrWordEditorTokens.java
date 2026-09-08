package com.booking.system.hr.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
@RequiredArgsConstructor
public class HrWordEditorTokens {
    private final HrWordEditorSettings settings;
    public String sign(Map<String, ?> claims) {
        settings.requireConfigured();
        return Jwts.builder().claims(claims).expiration(new Date(System.currentTimeMillis() + 86400000L))
                .signWith(Keys.hmacShaKeyFor(settings.secret().getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }
    public Map<String, Object> verify(String token) {
        settings.requireConfigured();
        var jwt = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(settings.secret().getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(token);
        if (!"HS256".equals(jwt.getHeader().getAlgorithm())) throw new IllegalArgumentException("Invalid signing algorithm");
        return jwt.getPayload();
    }
}

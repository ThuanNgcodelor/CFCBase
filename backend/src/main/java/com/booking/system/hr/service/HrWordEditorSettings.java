package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.nio.charset.StandardCharsets;

@Component
public record HrWordEditorSettings(
        @Value("${cfc.word-editor.enabled:false}") boolean enabled,
        @Value("${cfc.word-editor.document-server-url:}") String serverUrl,
        @Value("${cfc.word-editor.backend-url:}") String backendUrl,
        @Value("${cfc.word-editor.jwt-secret:}") String secret) {
    public void requireConfigured() {
        if (!enabled || secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw HrApiException.conflict("WORD_EDITOR_NOT_CONFIGURED", "Chưa cấu hình Document Server để sửa Word trực tiếp. Liên hệ quản trị hệ thống.");
        base(serverUrl); base(backendUrl);
    }
    public static URI base(String value) {
        try {
            URI u = URI.create(value);
            if (u.getHost() == null || u.getUserInfo() != null || u.getQuery() != null || u.getFragment() != null
                    || !("https".equals(u.getScheme()) || "http".equals(u.getScheme()))
                    || !(u.getPath().isEmpty() || u.getPath().equals("/"))) throw new IllegalArgumentException();
            return u;
        } catch (Exception e) { throw HrApiException.conflict("WORD_EDITOR_URL_INVALID", "Document Server/backend URL phải là origin HTTP(S), không kèm đường dẫn."); }
    }
    public String serverOrigin() { return base(serverUrl).toString().replaceAll("/$", ""); }
    public String backendOrigin() { return base(backendUrl).toString().replaceAll("/$", ""); }
    public URI trustedDownload(String url) {
        URI root = base(serverUrl), target;
        try { target = URI.create(url); } catch (Exception e) { throw new IllegalArgumentException("Invalid document URL"); }
        if (!root.getScheme().equalsIgnoreCase(target.getScheme()) || !root.getHost().equalsIgnoreCase(target.getHost())
                || effectivePort(root) != effectivePort(target) || target.getUserInfo() != null || target.getFragment() != null
                || !target.getPath().startsWith("/cache/files/") || target.getPath().contains("..")
                || target.getRawPath().contains("%")) throw new IllegalArgumentException("Untrusted document URL");
        return target;
    }
    private static int effectivePort(URI uri) { return uri.getPort() < 0 ? ("https".equals(uri.getScheme()) ? 443 : 80) : uri.getPort(); }
}

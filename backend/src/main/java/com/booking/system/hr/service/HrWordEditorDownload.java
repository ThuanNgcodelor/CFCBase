package com.booking.system.hr.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.net.HttpURLConnection;
import java.util.concurrent.*;

@Component
@RequiredArgsConstructor
public class HrWordEditorDownload {
    private final HrWordEditorSettings settings;
    public byte[] fetch(String url) throws Exception {
        var uri = settings.trustedDownload(url);
        // No redirects, exact configured origin and cache path only. Network is outside DB transactions.
        var connection=(HttpURLConnection) uri.toURL().openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(5000); connection.setReadTimeout(15000);
        try (var timer=Executors.newSingleThreadScheduledExecutor()) {
            var deadline=timer.schedule(connection::disconnect,30,TimeUnit.SECONDS);
            try {
                if (connection.getResponseCode()!=200) throw new IllegalArgumentException("Document download failed");
                if (connection.getContentLengthLong()>HrDocxEngine.MAX_BYTES) throw new IllegalArgumentException("Document too large");
                try (var input=connection.getInputStream()) {
                    byte[] bytes=input.readNBytes(HrDocxEngine.MAX_BYTES+1);
                    HrDocxEngine.tokens(bytes);
                    return bytes;
                }
            } finally { deadline.cancel(false); connection.disconnect(); }
        }
    }
}

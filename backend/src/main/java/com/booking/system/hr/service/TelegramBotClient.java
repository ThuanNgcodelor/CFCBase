package com.booking.system.hr.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class TelegramBotClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${cfc.telegram.bot-token:}")
    private String botToken;

    public TelegramBotClient() {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public void sendContactRequest(Long chatId) {
        send("sendMessage", Map.of(
                "chat_id", chatId,
                "text", "Để đăng ký nhận phiếu lương, vui lòng chia sẻ số điện thoại Telegram.",
                "reply_markup", Map.of(
                        "keyboard", List.of(List.of(Map.of("text", "Chia sẻ số điện thoại", "request_contact", true))),
                        "resize_keyboard", true,
                        "one_time_keyboard", true
                )
        ));
    }

    public boolean sendText(Long chatId, String text) {
        return send("sendMessage", Map.of("chat_id", chatId, "text", text));
    }

    public record PayrollSendResult(boolean sent, String error) { }

    public PayrollSendResult sendPayrollText(Long chatId, String text) {
        if (!configured()) return new PayrollSendResult(false, "RETRYABLE: Chưa cấu hình token Telegram; chưa gửi yêu cầu.");
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.telegram.org/bot" + botToken + "/sendMessage"))
                    .timeout(Duration.ofSeconds(8)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(Map.of("chat_id", chatId, "text", text))))
                    .build();
            var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return classifyPayrollResponse(response.statusCode(), response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new PayrollSendResult(false, "UNCERTAIN: Bị ngắt khi gửi; cần đối soát, không gửi lại tự động.");
        } catch (Exception e) {
            return new PayrollSendResult(false, "UNCERTAIN: Không nhận được xác nhận; tin có thể đã gửi. Cần đối soát, không gửi lại tự động.");
        }
    }

    public static PayrollSendResult classifyPayrollResponse(int status, String body) {
        try {
            var json = new ObjectMapper().readTree(body);
            if (status / 100 == 2 && json.path("ok").asBoolean(false) && json.path("result").has("message_id"))
                return new PayrollSendResult(true, null);
            if (json.has("ok") && !json.path("ok").asBoolean(true)) {
                int code = json.path("error_code").asInt(status);
                if (code == 429) return new PayrollSendResult(false, "RETRYABLE: Telegram giới hạn tốc độ. Chờ ít nhất "
                        + Math.max(1, json.path("parameters").path("retry_after").asInt(60)) + " giây rồi thử lại.");
                if (code >= 400 && code < 500) return new PayrollSendResult(false,
                        "REJECTED: Telegram từ chối yêu cầu (mã " + code + "). Kiểm tra bot và người nhận trước khi thử lại.");
            }
        } catch (Exception ignored) { /* Never retain raw Telegram response or credentials. */ }
        return new PayrollSendResult(false, "UNCERTAIN: Phản hồi Telegram không xác định; cần đối soát, không gửi lại tự động.");
    }

    public boolean testConnection() {
        if (!configured()) {
            log.warn("Telegram connection test skipped: TELEGRAM_BOT_TOKEN is not configured");
            return false;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.telegram.org/bot" + botToken + "/getMe"))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            return httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() / 100 == 2;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean send(String method, Map<String, Object> payload) {
        if (!configured()) {
            log.warn("Telegram send skipped: TELEGRAM_BOT_TOKEN is not configured");
            return false;
        }
        try {
            String body = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.telegram.org/bot" + botToken + "/" + method))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            int status = httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status / 100 != 2) log.warn("Telegram API {} returned HTTP {}", method, status);
            return status / 100 == 2;
        } catch (Exception exception) {
            // Lỗi gửi lời nhắc không được làm webhook tạo lại registration.
            log.warn("Telegram API {} request failed: {}", method, exception.getClass().getSimpleName());
            return false;
        }
    }

    private boolean configured() {
        return botToken != null && !botToken.isBlank();
    }
}

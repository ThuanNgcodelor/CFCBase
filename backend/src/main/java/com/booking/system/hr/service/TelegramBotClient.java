package com.booking.system.hr.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
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

    public boolean testConnection() {
        if (!configured()) return false;
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
        if (!configured()) return false;
        try {
            String body = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.telegram.org/bot" + botToken + "/" + method))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            return httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() / 100 == 2;
        } catch (Exception ignored) {
            // Lỗi gửi lời nhắc không được làm webhook tạo lại registration.
            return false;
        }
    }

    private boolean configured() {
        return botToken != null && !botToken.isBlank();
    }
}

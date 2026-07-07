package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.Notification;
import com.booking.system.entity.User;
import com.booking.system.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    
    private final NotificationService notificationService;

    @GetMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<Notification>>> getNotifications(
            @PathVariable String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(notificationService.getNotificationsForUserPaged(userId, pageable), "Lấy danh sách thông báo thành công"));
    }

    /**
     * Lấy số thông báo chưa đọc hiện tại (dùng cho badge)
     * GET /api/v1/notifications/unread-count
     */
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount(
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).body(ApiResponse.error(401, "Chưa đăng nhập"));
        long count = notificationService.getUnreadCount(user.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("count", count), "OK"));
    }

    /**
     * Lấy các thông báo chưa đọc mới hơn `since` (dùng cho polling hiển thị system notification)
     * GET /api/v1/notifications/unread-since?since=2024-01-01T00:00:00
     */
    @GetMapping("/unread-since")
    public ResponseEntity<ApiResponse<List<Notification>>> getUnreadSince(
            @AuthenticationPrincipal User user,
            @RequestParam String since) {
        if (user == null) return ResponseEntity.status(401).body(ApiResponse.error(401, "Chưa đăng nhập"));
        LocalDateTime sinceTime = LocalDateTime.parse(since);
        List<Notification> newNotifs = notificationService.getUnreadSince(user.getId(), sinceTime);
        return ResponseEntity.ok(ApiResponse.success(newNotifs, "OK"));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable String id) {
        try {
            notificationService.markAsRead(id);
            return ResponseEntity.ok(ApiResponse.success(null, "Đánh dấu đã đọc thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }
}

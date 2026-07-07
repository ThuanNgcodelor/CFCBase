package com.booking.system.service;

import com.booking.system.entity.Notification;
import com.booking.system.entity.User;
import com.booking.system.enums.NotificationType;
import com.booking.system.enums.RoleEnum;
import com.booking.system.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    @Transactional
    public void createNotification(User user, User sender, String title, String description, NotificationType type) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setSender(sender);
        notification.setTitle(title);
        notification.setDescription(description);
        notification.setType(type);
        Notification savedNotification = notificationRepository.save(notification);
        
        // Gửi thông báo realtime qua WebSocket
        messagingTemplate.convertAndSend("/topic/notifications/" + user.getId(), savedNotification);

        // Gửi Email bất đồng bộ
        if (type == NotificationType.BOOKING_CREATED) {
            if (user.getRole() == RoleEnum.ADMIN) {
                emailService.sendBookingCreatedEmailToAdmin(user.getEmail(), sender != null ? sender.getFullName() : "Ai đó", "Tài nguyên", title);
            }
        } else if (type == NotificationType.BOOKING_APPROVED) {
            emailService.sendBookingApprovedEmail(user.getEmail(), "Tài nguyên", title);
        } else if (type == NotificationType.BOOKING_REJECTED) {
            emailService.sendBookingRejectedEmail(user.getEmail(), "Tài nguyên", title, description);
        }
    }

    public List<Notification> getNotificationsForUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public org.springframework.data.domain.Page<Notification> getNotificationsForUserPaged(String userId, org.springframework.data.domain.Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    @Transactional
    public void markAsRead(String notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông báo"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    /**
     * Đếm số thông báo chưa đọc của user
     */
    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    /**
     * Lấy các thông báo chưa đọc mới hơn thời điểm `since` (dùng cho polling)
     * since: ISO timestamp dưới dạng LocalDateTime
     */
    public List<Notification> getUnreadSince(String userId, LocalDateTime since) {
        return notificationRepository.findUnreadSince(userId, since);
    }
}

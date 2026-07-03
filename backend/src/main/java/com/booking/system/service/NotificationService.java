package com.booking.system.service;

import com.booking.system.entity.Notification;
import com.booking.system.entity.User;
import com.booking.system.enums.NotificationType;
import com.booking.system.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

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
}

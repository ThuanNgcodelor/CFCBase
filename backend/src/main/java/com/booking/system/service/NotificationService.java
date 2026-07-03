package com.booking.system.service;

import com.booking.system.entity.Notification;
import com.booking.system.entity.User;
import com.booking.system.enums.NotificationType;
import com.booking.system.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {
    
    private final NotificationRepository notificationRepository;

    @Transactional
    public void createNotification(User user, User sender, String title, String description, NotificationType type) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setSender(sender);
        notification.setTitle(title);
        notification.setDescription(description);
        notification.setType(type);
        notificationRepository.save(notification);
    }

    public List<Notification> getNotificationsForUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public void markAsRead(String notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông báo"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }
}

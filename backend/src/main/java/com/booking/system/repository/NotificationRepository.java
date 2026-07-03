package com.booking.system.repository;

import com.booking.system.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    Page<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
    
    // Giữ lại hàm cũ phòng trường hợp cần dùng
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
}

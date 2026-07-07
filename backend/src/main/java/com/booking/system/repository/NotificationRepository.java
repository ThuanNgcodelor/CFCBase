package com.booking.system.repository;

import com.booking.system.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    Page<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    // Giữ lại hàm cũ phòng trường hợp cần dùng
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    // Đếm tổng số thông báo chưa đọc của user
    long countByUserIdAndIsReadFalse(String userId);

    // Lấy các thông báo chưa đọc mới hơn một thời điểm (dùng cho polling)
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.isRead = false AND n.createdAt > :since ORDER BY n.createdAt DESC")
    List<Notification> findUnreadSince(@Param("userId") String userId, @Param("since") LocalDateTime since);
}

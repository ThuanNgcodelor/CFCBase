package com.booking.system.repository;

import com.booking.system.entity.BookingRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface BookingRoomRepository extends JpaRepository<BookingRoom, String> {

    /**
     * Đếm số lượng booking của 1 phòng trong khoảng thời gian có bị trùng hay không.
     * Logic trùng: NewStart < ExistingEnd AND NewEnd > ExistingStart
     */
    @Query("SELECT COUNT(b) FROM BookingRoom b WHERE b.room.id = :roomId " +
           "AND b.status IN ('PENDING', 'APPROVED') " +
           "AND b.startTime < :endTime AND b.endTime > :startTime")
    long countOverlappingBookings(@Param("roomId") String roomId, 
                                  @Param("startTime") LocalDateTime startTime, 
                                  @Param("endTime") LocalDateTime endTime);
}

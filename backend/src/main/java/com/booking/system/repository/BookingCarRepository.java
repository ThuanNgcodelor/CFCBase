package com.booking.system.repository;

import com.booking.system.entity.BookingCar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface BookingCarRepository extends JpaRepository<BookingCar, String> {

    @Query("SELECT COUNT(b) FROM BookingCar b WHERE b.vehicle.id = :vehicleId " +
           "AND b.status IN ('PENDING', 'APPROVED') " +
           "AND b.startTime < :endTime AND b.endTime > :startTime")
    long countOverlappingBookings(@Param("vehicleId") String vehicleId, 
                                  @Param("startTime") LocalDateTime startTime, 
                                  @Param("endTime") LocalDateTime endTime);
}

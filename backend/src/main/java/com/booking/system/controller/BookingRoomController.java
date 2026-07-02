package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.dto.BookingRoomRequest;
import com.booking.system.entity.BookingRoom;
import com.booking.system.service.BookingRoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings/rooms")
@RequiredArgsConstructor
public class BookingRoomController {

    private final BookingRoomService bookingRoomService;

    /**
     * API tạo mới yêu cầu đặt phòng họp.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<BookingRoom>> createBooking(@Valid @RequestBody BookingRoomRequest request) {
        try {
            BookingRoom booking = bookingRoomService.createBooking(request);
            return ResponseEntity.ok(ApiResponse.success(booking, "Tạo yêu cầu đặt phòng thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(ApiResponse.error(500, "Đã xảy ra lỗi hệ thống: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.List<BookingRoom>>> getAllBookings() {
        return ResponseEntity.ok(ApiResponse.success(bookingRoomService.getAllBookings(), "Lấy danh sách đặt phòng thành công"));
    }
}

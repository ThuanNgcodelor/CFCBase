package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.dto.BookingCarRequest;
import com.booking.system.entity.BookingCar;
import com.booking.system.service.BookingCarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/bookings/cars")
@RequiredArgsConstructor
public class BookingCarController {

    private final BookingCarService bookingCarService;

    @PostMapping
    public ResponseEntity<ApiResponse<BookingCar>> createBooking(@Valid @RequestBody BookingCarRequest request) {
        try {
            BookingCar booking = bookingCarService.createBooking(request);
            return ResponseEntity.ok(ApiResponse.success(booking, "Tạo yêu cầu đặt xe thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(ApiResponse.error(500, "Đã xảy ra lỗi hệ thống: " + e.getMessage()));
        }
    }
    
    @GetMapping
    public ResponseEntity<ApiResponse<List<BookingCar>>> getAllBookings() {
        return ResponseEntity.ok(ApiResponse.success(bookingCarService.getAllBookings(), "Lấy danh sách đặt xe thành công"));
    }
}

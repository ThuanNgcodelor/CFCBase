package com.booking.system.service;

import com.booking.system.dto.BookingCarRequest;
import com.booking.system.entity.BookingCar;
import com.booking.system.entity.Vehicle;
import com.booking.system.entity.User;
import com.booking.system.enums.BookingStatus;
import com.booking.system.repository.BookingCarRepository;
import com.booking.system.repository.VehicleRepository;
import com.booking.system.repository.UserRepository;
import com.booking.system.enums.NotificationType;
import com.booking.system.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingCarService {

    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;
    private final BookingCarRepository bookingCarRepository;
    private final NotificationService notificationService;

    @Transactional
    public BookingCar createBooking(BookingCarRequest request) {
        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().isEqual(request.getEndTime())) {
            throw new RuntimeException("Thời gian bắt đầu phải trước thời gian kết thúc.");
        }

        Vehicle vehicle = vehicleRepository.findByIdWithLock(request.getVehicleId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy xe"));

        User requester = userRepository.findById(request.getRequesterId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người đặt"));

        long overlaps = bookingCarRepository.countOverlappingBookings(
                vehicle.getId(), request.getStartTime(), request.getEndTime());

        if (overlaps > 0) {
            throw new RuntimeException("Xe đã có người đặt trong khoảng thời gian này.");
        }

        BookingCar booking = new BookingCar();
        booking.setVehicle(vehicle);
        booking.setRequester(requester);
        booking.setDeparture(request.getDeparture());
        booking.setDestination(request.getDestination());
        booking.setStartTime(request.getStartTime());
        booking.setEndTime(request.getEndTime());
        booking.setNote(request.getNote());
        booking.setStatus(BookingStatus.PENDING);

        BookingCar saved = bookingCarRepository.save(booking);
        
        notificationService.createNotification(requester, 
            "Tạo yêu cầu đặt xe thành công", 
            "Yêu cầu đặt xe từ '" + saved.getDeparture() + "' đi '" + saved.getDestination() + "' đã được gửi và đang chờ duyệt.", 
            NotificationType.BOOKING_CREATED);
            
        return saved;
    }
    
    public List<BookingCar> getAllBookings() {
        return bookingCarRepository.findAll();
    }
}

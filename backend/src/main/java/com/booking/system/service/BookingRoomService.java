package com.booking.system.service;

import com.booking.system.dto.BookingRoomRequest;
import com.booking.system.entity.BookingRoom;
import com.booking.system.entity.Room;
import com.booking.system.entity.User;
import com.booking.system.enums.BookingStatus;
import com.booking.system.enums.RoomStatus;
import com.booking.system.repository.BookingRoomRepository;
import com.booking.system.repository.RoomRepository;
import com.booking.system.repository.UserRepository;
import com.booking.system.enums.NotificationType;
import com.booking.system.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingRoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final NotificationService notificationService;

    /**
     * Hàm đặt phòng có kiểm tra trùng lịch và khóa DB.
     * @param request dữ liệu đặt phòng
     * @return BookingRoom đã tạo
     */
    @Transactional
    public BookingRoom createBooking(BookingRoomRequest request) {
        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().isEqual(request.getEndTime())) {
            throw new RuntimeException("Thời gian bắt đầu phải trước thời gian kết thúc.");
        }

        // 1. Lấy Room và khóa dòng này lại (Pessimistic Write)
        // Bất kỳ thread nào khác muốn đặt phòng này cũng phải chờ thread hiện tại hoàn thành.
        Room room = roomRepository.findByIdWithLock(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng"));

        if (room.getStatus() != RoomStatus.ACTIVE) {
            throw new RuntimeException("Phòng đang không hoạt động (Bảo trì hoặc Ngưng sử dụng)");
        }

        User requester = userRepository.findById(request.getRequesterId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người đặt"));

        // 2. Kiểm tra trùng lịch (Dựa trên những booking đã duyệt hoặc đang chờ duyệt)
        long overlaps = bookingRoomRepository.countOverlappingBookings(
                room.getId(), request.getStartTime(), request.getEndTime());

        if (overlaps > 0) {
            throw new RuntimeException("Phòng đã có người đặt trong khoảng thời gian này.");
        }

        // 3. Tạo mới Booking
        BookingRoom booking = new BookingRoom();
        booking.setRoom(room);
        booking.setRequester(requester);
        booking.setTitle(request.getTitle());
        booking.setStartTime(request.getStartTime());
        booking.setEndTime(request.getEndTime());
        booking.setAttendeeCount(request.getAttendeeCount());
        booking.setNote(request.getNote());
        booking.setStatus(BookingStatus.PENDING); // Chờ duyệt

        BookingRoom saved = bookingRoomRepository.save(booking);
        
        notificationService.createNotification(requester, 
            "Tạo yêu cầu đặt phòng thành công", 
            "Yêu cầu đặt phòng '" + saved.getTitle() + "' đã được gửi và đang chờ duyệt.", 
            NotificationType.BOOKING_CREATED);
            
        return saved;
    }

    public java.util.List<BookingRoom> getAllBookings() {
        return bookingRoomRepository.findAll();
    }
}

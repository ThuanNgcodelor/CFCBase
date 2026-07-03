package com.booking.system.service;

import com.booking.system.dto.ApprovalRequest;
import com.booking.system.entity.ApprovalStep;
import com.booking.system.entity.BookingCar;
import com.booking.system.entity.BookingRoom;
import com.booking.system.entity.User;
import com.booking.system.enums.ApprovalStatus;
import com.booking.system.enums.BookingStatus;
import com.booking.system.enums.NotificationType;
import com.booking.system.repository.ApprovalStepRepository;
import com.booking.system.repository.BookingCarRepository;
import com.booking.system.repository.BookingRoomRepository;
import com.booking.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final BookingRoomRepository bookingRoomRepository;
    private final BookingCarRepository bookingCarRepository;
    private final UserRepository userRepository;
    private final ApprovalStepRepository approvalStepRepository;
    private final NotificationService notificationService;

    @Transactional
    public void approveRoom(String bookingId, ApprovalRequest request) {
        BookingRoom booking = bookingRoomRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lịch đặt phòng"));
        User approver = userRepository.findById(request.getApproverId())
                .orElseThrow(() -> new RuntimeException("Người duyệt không tồn tại"));

        booking.setStatus(BookingStatus.APPROVED);
        bookingRoomRepository.save(booking);

        saveApprovalStep(approver, booking, null, ApprovalStatus.APPROVED, request.getReason());
        
        notificationService.createNotification(booking.getRequester(), approver,
            "Yêu cầu đặt phòng đã được duyệt", 
            "Lịch đặt phòng '" + booking.getTitle() + "' đã được duyệt.", 
            NotificationType.BOOKING_APPROVED);
    }

    @Transactional
    public void rejectRoom(String bookingId, ApprovalRequest request) {
        BookingRoom booking = bookingRoomRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lịch đặt phòng"));
        User approver = userRepository.findById(request.getApproverId())
                .orElseThrow(() -> new RuntimeException("Người duyệt không tồn tại"));

        booking.setStatus(BookingStatus.REJECTED);
        bookingRoomRepository.save(booking);

        saveApprovalStep(approver, booking, null, ApprovalStatus.REJECTED, request.getReason());
        
        notificationService.createNotification(booking.getRequester(), approver,
            "Yêu cầu đặt phòng bị từ chối", 
            "Lịch đặt phòng '" + booking.getTitle() + "' bị từ chối. Lý do: " + request.getReason(), 
            NotificationType.BOOKING_REJECTED);
    }

    @Transactional
    public void approveCar(String bookingId, ApprovalRequest request) {
        BookingCar booking = bookingCarRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lịch đặt xe"));
        User approver = userRepository.findById(request.getApproverId())
                .orElseThrow(() -> new RuntimeException("Người duyệt không tồn tại"));

        booking.setStatus(BookingStatus.APPROVED);
        bookingCarRepository.save(booking);

        saveApprovalStep(approver, null, booking, ApprovalStatus.APPROVED, request.getReason());
        
        notificationService.createNotification(booking.getRequester(), approver,
            "Yêu cầu đặt xe đã được duyệt", 
            "Lịch đặt xe từ '" + booking.getDeparture() + "' đi '" + booking.getDestination() + "' đã được duyệt.", 
            NotificationType.BOOKING_APPROVED);
    }

    @Transactional
    public void rejectCar(String bookingId, ApprovalRequest request) {
        BookingCar booking = bookingCarRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lịch đặt xe"));
        User approver = userRepository.findById(request.getApproverId())
                .orElseThrow(() -> new RuntimeException("Người duyệt không tồn tại"));

        booking.setStatus(BookingStatus.REJECTED);
        bookingCarRepository.save(booking);

        saveApprovalStep(approver, null, booking, ApprovalStatus.REJECTED, request.getReason());
        
        notificationService.createNotification(booking.getRequester(), approver,
            "Yêu cầu đặt xe bị từ chối", 
            "Lịch đặt xe từ '" + booking.getDeparture() + "' đi '" + booking.getDestination() + "' bị từ chối. Lý do: " + request.getReason(), 
            NotificationType.BOOKING_REJECTED);
    }

    private void saveApprovalStep(User approver, BookingRoom room, BookingCar car, ApprovalStatus status, String reason) {
        ApprovalStep step = new ApprovalStep();
        step.setApprover(approver);
        step.setBookingRoom(room);
        step.setBookingCar(car);
        step.setStatus(status);
        step.setReason(reason);
        step.setActedAt(LocalDateTime.now());
        approvalStepRepository.save(step);
    }
}

package com.booking.system.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OtpMailService {

    private final JavaMailSender mailSender;

    // Gửi OTP đăng ký tài khoản qua email.
    public void sendRegisterOtp(String email, String otp) {
        sendOtp(email, "Mã OTP đăng ký CFC Booking", otp);
    }

    // Gửi OTP đặt lại mật khẩu qua email.
    public void sendForgotPasswordOtp(String email, String otp) {
        sendOtp(email, "Mã OTP đặt lại mật khẩu CFC Booking", otp);
    }

    private void sendOtp(String email, String subject, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject(subject);
        message.setText("""
                Mã OTP của bạn là: %s

                Mã có hiệu lực trong 5 phút.
                Không chia sẻ mã này cho người khác.
                """.formatted(otp));

        mailSender.send(message);
    }
}

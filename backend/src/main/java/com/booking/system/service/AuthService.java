package com.booking.system.service;

import com.booking.system.dto.AuthResponse;
import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import com.booking.system.enums.UserStatus;
import com.booking.system.repository.UserRepository;
import com.booking.system.security.JwtUtils;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtils jwtUtils;
    private final RedisTemplate<String, String> redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final OtpMailService otpMailService;

    @Value("${spring.security.oauth2.client.registration.google.client-id:YOUR_GOOGLE_CLIENT_ID}")
    private String googleClientId;

    public AuthResponse authenticate(String email, String password) {
        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không chính xác"));

        if (user.getPassword() == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Email hoặc mật khẩu không chính xác");
        }

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new RuntimeException("Tài khoản đã bị khóa");
        }

        return generateTokensForUser(user);
    }

    // Gửi OTP đăng ký cho email chưa tồn tại trong hệ thống.
    public void requestRegisterOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new RuntimeException("Email đã tồn tại trong hệ thống");
        }

        String otp = otpService.generateAndStoreOtp(otpService.registerKey(normalizedEmail));
        otpMailService.sendRegisterOtp(normalizedEmail, otp);
    }

    // Xác thực OTP và tạo tài khoản email/password mặc định quyền nhân viên.
    public void verifyRegisterOtp(String email, String otp, String password) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.existsByEmail(normalizedEmail)) {
            otpService.deleteOtp(otpService.registerKey(normalizedEmail));
            throw new RuntimeException("Email đã tồn tại trong hệ thống");
        }

        otpService.verifyOtp(otpService.registerKey(normalizedEmail), otp);

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setFullName(normalizedEmail.substring(0, normalizedEmail.indexOf("@")));
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(RoleEnum.EMPLOYEE);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
    }

    // Gửi OTP đặt lại mật khẩu cho email đang tồn tại.
    public void requestForgotPasswordOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (!userRepository.existsByEmail(normalizedEmail)) {
            throw new RuntimeException("Email không tồn tại trong hệ thống");
        }

        String otp = otpService.generateAndStoreOtp(otpService.forgotPasswordKey(normalizedEmail));
        otpMailService.sendForgotPasswordOtp(normalizedEmail, otp);
    }

    // Xác thực OTP và cập nhật mật khẩu mới, không thay đổi thông tin profile.
    public void resetPasswordWithOtp(String email, String otp, String newPassword) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new RuntimeException("Email không tồn tại trong hệ thống"));

        otpService.verifyOtp(otpService.forgotPasswordKey(normalizedEmail), otp);

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public AuthResponse authenticateWithGoogle(String idTokenString) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);

            if (idToken == null) {
                throw new RuntimeException("Token Google không hợp lệ");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String pictureUrl = (String) payload.get("picture");

            return processUserAuth(email, name, pictureUrl);

        } catch (Exception e) {
            throw new RuntimeException("Lỗi xác thực Google: " + e.getMessage());
        }
    }

    public AuthResponse authenticateDummyForDev(String email) {
        return processUserAuth(email, "Developer User", "");
    }

    private AuthResponse processUserAuth(String email, String name, String pictureUrl) {
        Optional<User> userOpt = userRepository.findByEmail(normalizeEmail(email));
        User user;

        if (userOpt.isPresent()) {
            user = userOpt.get();
            if (user.getStatus() == UserStatus.INACTIVE) {
                throw new RuntimeException("Tài khoản đã bị khóa");
            }
            // Cập nhật tên/avatar mới nhất từ Google
            user.setFullName(name);
            user.setAvatarUrl(pictureUrl);
            user = userRepository.save(user);
        } else {
            // Tạo mới user
            user = new User();
            user.setEmail(normalizeEmail(email));
            user.setFullName(name);
            user.setAvatarUrl(pictureUrl);
            user.setRole(RoleEnum.EMPLOYEE);
            user.setStatus(UserStatus.ACTIVE);
            user = userRepository.save(user);
        }

        return generateTokensForUser(user);
    }

    private AuthResponse generateTokensForUser(User user) {
        String accessToken = jwtUtils.generateAccessToken(user.getEmail(), user.getRole().name());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        redisTemplate.opsForValue().set(
                "refreshToken:" + user.getEmail(),
                refreshToken,
                7,
                TimeUnit.DAYS
        );

        AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getAvatarUrl(),
                user.getDepartment() == null ? null : user.getDepartment().getId(),
                user.getDepartment() == null ? null : user.getDepartment().getName(),
                user.getJobPosition(),
                user.getPassword() != null
        );

        return new AuthResponse(accessToken, refreshToken, userDto);
    }

    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtUtils.validateJwtToken(refreshToken)) {
            throw new RuntimeException("Refresh token không hợp lệ hoặc đã hết hạn");
        }

        String email = jwtUtils.getEmailFromJwtToken(refreshToken);
        String savedToken = redisTemplate.opsForValue().get("refreshToken:" + email);

        if (savedToken == null || !savedToken.equals(refreshToken)) {
            throw new RuntimeException("Refresh token không khớp hoặc đã bị thu hồi");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));

        // Cấp lại token mới
        String newAccessToken = jwtUtils.generateAccessToken(user.getEmail(), user.getRole().name());
        String newRefreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        redisTemplate.opsForValue().set("refreshToken:" + email, newRefreshToken, 7, TimeUnit.DAYS);

        AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getAvatarUrl(),
                user.getDepartment() == null ? null : user.getDepartment().getId(),
                user.getDepartment() == null ? null : user.getDepartment().getName(),
                user.getJobPosition(),
                user.getPassword() != null
        );

        return new AuthResponse(newAccessToken, newRefreshToken, userDto);
    }

    public void logout(String refreshToken) {
        try {
            if (jwtUtils.validateJwtToken(refreshToken)) {
                String email = jwtUtils.getEmailFromJwtToken(refreshToken);
                redisTemplate.delete("refreshToken:" + email);
            }
        } catch (Exception e) {
            // Bỏ qua lỗi token khi logout phía client.
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
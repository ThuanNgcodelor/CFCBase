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

    @Value("${spring.security.oauth2.client.registration.google.client-id:YOUR_GOOGLE_CLIENT_ID}")
    private String googleClientId;

    public AuthResponse authenticate(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không chính xác"));

        if (user.getPassword() == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Email hoặc mật khẩu không chính xác");
        }

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new RuntimeException("Tài khoản đã bị khóa");
        }

        return generateTokensForUser(user);
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
        Optional<User> userOpt = userRepository.findByEmail(email);
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
            user.setEmail(email);
            user.setFullName(name);
            user.setAvatarUrl(pictureUrl);
            user.setRole(RoleEnum.EMPLOYEE);
            user.setStatus(UserStatus.ACTIVE);
            user = userRepository.save(user);
        }

        // Tạo JWT
        String accessToken = jwtUtils.generateAccessToken(user.getEmail(), user.getRole().name());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        // Lưu Refresh Token vào Redis (Set expire bằng thời gian của refresh token, ví dụ 7 ngày)
        redisTemplate.opsForValue().set(
                "refreshToken:" + user.getEmail(), 
                refreshToken, 
                7, 
                TimeUnit.DAYS
        );

        AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.getAvatarUrl(), user.getPassword() != null
        );

        return new AuthResponse(accessToken, refreshToken, userDto);
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
                user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.getAvatarUrl(), user.getPassword() != null
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
                user.getId(), user.getEmail(), user.getFullName(), user.getRole().name(), user.getAvatarUrl(), user.getPassword() != null
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
            // Ignored, just proceed to logout on frontend
        }
    }
}

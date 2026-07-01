package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.dto.AuthResponse;
import com.booking.system.dto.GoogleLoginRequest;
import com.booking.system.dto.LoginRequest;
import com.booking.system.dto.RefreshTokenRequest;
import com.booking.system.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.authenticate(request.getEmail(), request.getPassword());
            return ResponseEntity.ok(ApiResponse.success(response, "Đăng nhập thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(401, e.getMessage()));
        }
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
        try {
            // Uncomment line below to bypass real Google Verification if you don't have Client ID configured yet
            // AuthResponse response = authService.authenticateDummyForDev("admin@booking.com");
            
            AuthResponse response = authService.authenticateWithGoogle(request.getIdToken());
            return ResponseEntity.ok(ApiResponse.success(response, "Đăng nhập thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(401, e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        try {
            AuthResponse response = authService.refreshToken(request.getRefreshToken());
            return ResponseEntity.ok(ApiResponse.success(response, "Refresh token thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(401, e.getMessage()));
        }
    }
}

package com.booking.system.controller;

import com.booking.system.dto.AdminDashboardStats;
import com.booking.system.dto.ApiResponse;
import com.booking.system.dto.ClientDashboardStats;
import com.booking.system.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<AdminDashboardStats>> getAdminStats() {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getAdminStats(), "Lấy thống kê admin thành công"));
    }

    @GetMapping("/client/{userId}")
    public ResponseEntity<ApiResponse<ClientDashboardStats>> getClientStats(@PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getClientStats(userId), "Lấy thống kê client thành công"));
    }
}

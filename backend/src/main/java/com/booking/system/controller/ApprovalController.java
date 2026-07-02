package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.dto.ApprovalRequest;
import com.booking.system.service.ApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    @PostMapping("/rooms/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveRoom(@PathVariable String id, @Valid @RequestBody ApprovalRequest request) {
        try {
            approvalService.approveRoom(id, request);
            return ResponseEntity.ok(ApiResponse.success(null, "Phê duyệt đặt phòng thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }

    @PostMapping("/rooms/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectRoom(@PathVariable String id, @Valid @RequestBody ApprovalRequest request) {
        try {
            approvalService.rejectRoom(id, request);
            return ResponseEntity.ok(ApiResponse.success(null, "Từ chối đặt phòng thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }

    @PostMapping("/cars/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveCar(@PathVariable String id, @Valid @RequestBody ApprovalRequest request) {
        try {
            approvalService.approveCar(id, request);
            return ResponseEntity.ok(ApiResponse.success(null, "Phê duyệt đặt xe thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }

    @PostMapping("/cars/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectCar(@PathVariable String id, @Valid @RequestBody ApprovalRequest request) {
        try {
            approvalService.rejectCar(id, request);
            return ResponseEntity.ok(ApiResponse.success(null, "Từ chối đặt xe thành công"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }
}

package com.booking.system.controller;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import com.booking.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/approvers")
    public ResponseEntity<ApiResponse<List<User>>> getApprovers() {
        // Lấy danh sách ADMIN và MANAGER
        List<User> approvers = userRepository.findByRoleIn(Arrays.asList(RoleEnum.ADMIN, RoleEnum.MANAGER));
        // Có thể sắp xếp Admin lên trước bằng Java Stream
        approvers.sort((u1, u2) -> {
            if (u1.getRole() == RoleEnum.ADMIN && u2.getRole() != RoleEnum.ADMIN) return -1;
            if (u1.getRole() != RoleEnum.ADMIN && u2.getRole() == RoleEnum.ADMIN) return 1;
            return 0;
        });
        return ResponseEntity.ok(ApiResponse.success(approvers, "Lấy danh sách người duyệt thành công"));
    }
}

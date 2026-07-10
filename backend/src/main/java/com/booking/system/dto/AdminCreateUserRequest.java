package com.booking.system.dto;

import com.booking.system.enums.RoleEnum;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AdminCreateUserRequest(
        @Email(message = "Email không hợp lệ")
        @NotBlank(message = "Email không được để trống")
        String email,

        @NotBlank(message = "Mật khẩu không được để trống")
        String password,

        RoleEnum role,

        String departmentId,

        String fullName,

        String jobPosition
) {
}

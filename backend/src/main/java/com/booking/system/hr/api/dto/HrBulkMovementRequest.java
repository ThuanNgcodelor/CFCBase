package com.booking.system.hr.api.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record HrBulkMovementRequest(
        @NotEmpty(message = "Danh sách biến động không được rỗng")
        List<String> movementIds
) {
}

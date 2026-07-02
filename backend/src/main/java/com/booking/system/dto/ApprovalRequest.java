package com.booking.system.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalRequest {
    @NotBlank(message = "ID người duyệt không được để trống")
    private String approverId;
    
    private String reason;
}

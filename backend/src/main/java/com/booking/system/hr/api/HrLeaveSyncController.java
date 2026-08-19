package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.hr.api.dto.HrLeaveSyncItemResponse;
import com.booking.system.hr.service.HrLeaveSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hr/sync")
@RequiredArgsConstructor
public class HrLeaveSyncController {

    private final HrLeaveSyncService syncService;

    @GetMapping("/leave-roster")
    public ResponseEntity<ApiResponse<List<HrLeaveSyncItemResponse>>> getLeaveSyncRoster(
            @RequestParam(required = false) String period,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly
    ) {
        List<HrLeaveSyncItemResponse> result = syncService.getLeaveSyncRoster(period, activeOnly);
        return ResponseEntity.ok(ApiResponse.success(
                result,
                "Lấy danh sách đồng bộ ngày phép nhân sự thành công"
        ));
    }
}

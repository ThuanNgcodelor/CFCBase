package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrOnboardingDtos;
import com.booking.system.hr.service.HrOnboardingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hr/onboarding")
public class HrOnboardingController {

    private final HrOnboardingService onboardingService;
    private final HrActorResolver actorResolver;

    public HrOnboardingController(HrOnboardingService onboardingService, HrActorResolver actorResolver) {
        this.onboardingService = onboardingService;
        this.actorResolver = actorResolver;
    }

    @PostMapping("/general-labor")
    public ResponseEntity<ApiResponse<HrOnboardingDtos.GeneralLaborOnboardingResponse>> onboardGeneralLabor(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrOnboardingDtos.GeneralLaborOnboardingRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                onboardingService.onboardGeneralLabor(request, actorResolver.fromPrincipal(principal)),
                "Đã tạo hồ sơ lao động phổ thông chờ tăng nhân sự"
        ));
    }
}

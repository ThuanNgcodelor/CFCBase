package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.service.HrDocumentTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/hr/document-templates")
@RequiredArgsConstructor
public class HrDocumentTemplateController {
    private final HrDocumentTemplateService service;
    private final HrActorResolver actors;

    @GetMapping("/{kind}")
    public ApiResponse<List<HrDocumentTemplateService.Revision>> list(@PathVariable String kind, @RequestParam(defaultValue="0") int page) {
        return ApiResponse.success(service.list(kind,page),"Danh sách mẫu");
    }

    @PostMapping("/{kind}/{id}/restore")
    public ApiResponse<Void> restore(@PathVariable String kind, @PathVariable String id, @AuthenticationPrincipal User user) {
        service.activate(kind,id,actors.fromPrincipal(user));
        return ApiResponse.success(null,"Đã khôi phục mẫu");
    }
}

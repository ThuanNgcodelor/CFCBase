package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.service.HrOcrCaptureService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController
@RequestMapping("/api/v1/hr/general-labor/ocr-captures")
public class HrOcrCaptureController {
    private final HrOcrCaptureService service;
    private final HrActorResolver actors;
    public HrOcrCaptureController(HrOcrCaptureService service, HrActorResolver actors) { this.service = service; this.actors = actors; }
    public record Open(String id) {}
    public record Scan(long revision) {}
    public record Close(boolean completed) {}
    @ModelAttribute public void privateResponse(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, private");
        response.setHeader("X-Content-Type-Options", "nosniff");
    }
    @PostMapping public ApiResponse<?> open(@RequestBody Open body, @AuthenticationPrincipal User user) {
        return ok(service.open(body.id(), actors.fromPrincipal(user)));
    }
    @GetMapping("/{id}") public ApiResponse<?> get(@PathVariable String id, @AuthenticationPrincipal User user) {
        return ok(service.get(id, actors.fromPrincipal(user)));
    }
    @PostMapping("/{id}/pair") public ApiResponse<?> pair(@PathVariable String id, @AuthenticationPrincipal User user) {
        return ok(service.pair(id, actors.fromPrincipal(user)));
    }
    @PostMapping(value="/{id}/images", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> upload(@PathVariable String id, @RequestParam String clientId, @RequestParam String kind,
                                @RequestParam MultipartFile file, @AuthenticationPrincipal User user) throws IOException {
        return ok(service.upload(id, clientId, kind, file, actors.fromPrincipal(user)));
    }
    @GetMapping("/{id}/images/{imageId}") public ResponseEntity<byte[]> image(@PathVariable String id, @PathVariable String imageId, @AuthenticationPrincipal User user) {
        var image = service.image(id, imageId, actors.fromPrincipal(user));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.type())).body(image.bytes());
    }
    @DeleteMapping("/{id}/images/{imageId}") public ApiResponse<?> remove(@PathVariable String id, @PathVariable String imageId, @AuthenticationPrincipal User user) {
        return ok(service.remove(id, imageId, actors.fromPrincipal(user)));
    }
    @PostMapping("/{id}/scan") public ApiResponse<?> scan(@PathVariable String id, @RequestBody Scan body, @AuthenticationPrincipal User user) {
        return ok(service.scan(id, body.revision(), actors.fromPrincipal(user)));
    }
    @PostMapping("/{id}/close") public ApiResponse<?> close(@PathVariable String id, @RequestBody Close body, @AuthenticationPrincipal User user) {
        return ok(service.close(id, body.completed(), actors.fromPrincipal(user)));
    }
    private ApiResponse<?> ok(Object data) { return ApiResponse.success(data, "Đã cập nhật phiên chụp."); }
}

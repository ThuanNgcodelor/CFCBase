package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.service.HrWordEditorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HrWordEditorController {
    private final HrWordEditorService service;
    private final HrActorResolver actors;
    private static final MediaType DOCX=MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    @PostMapping("/api/v1/hr/word-editor/sessions")
    public ResponseEntity<?> open(@RequestBody HrWordEditorService.OpenRequest request,@AuthenticationPrincipal User user) {
        return ok(service.open(request,actors.fromPrincipal(user)));
    }
    @GetMapping("/api/v1/hr/word-editor/sessions/{id}")
    public ResponseEntity<?> state(@PathVariable String id,@AuthenticationPrincipal User user) { return ok(service.owned(id,actors.fromPrincipal(user))); }
    @GetMapping("/api/v1/hr/word-editor/sessions/{id}/config")
    public ResponseEntity<?> config(@PathVariable String id,@AuthenticationPrincipal User user) { return ok(service.resume(id,actors.fromPrincipal(user))); }
    @GetMapping("/api/v1/hr/word-editor/sessions/{id}/draft")
    public ResponseEntity<byte[]> draft(@PathVariable String id,@AuthenticationPrincipal User user) {
        return ResponseEntity.ok().contentType(DOCX).header("Cache-Control","no-store").body(service.draft(id,actors.fromPrincipal(user)));
    }
    public record PublishRequest(String note) { }
    @PostMapping("/api/v1/hr/word-editor/sessions/{id}/publish")
    public ResponseEntity<?> publish(@PathVariable String id,@RequestBody PublishRequest request,@AuthenticationPrincipal User user) {
        return ok(service.publish(id,request.note(),actors.fromPrincipal(user)));
    }
    @PostMapping("/api/v1/hr/word-editor/sessions/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable String id,@AuthenticationPrincipal User user) {
        service.cancel(id,actors.fromPrincipal(user));
        return ok(null);
    }
    // Service-to-service routes use ONLYOFFICE JWT/capability tickets, not the user's login JWT.
    @GetMapping("/api/v1/word-editor/{id}/content")
    public ResponseEntity<byte[]> content(@PathVariable String id,@RequestParam String ticket) {
        try { return ResponseEntity.ok().contentType(DOCX).header("Cache-Control","no-store").body(service.source(id,ticket)); }
        catch (Exception e) { return ResponseEntity.status(403).build(); }
    }
    @PostMapping("/api/v1/word-editor/{id}/callback")
    public ResponseEntity<Map<String,Integer>> callback(@PathVariable String id,@RequestBody Map<String,Object> body,
            @RequestHeader(value="X-Onlyoffice-JWT",required=false) String header,
            @RequestHeader(value="Authorization",required=false) String authorization) {
        String token=body.get("token") instanceof String value ? value : header == null ? authorization : header;
        if (token != null && token.startsWith("Bearer ")) token=token.substring(7);
        try { service.callback(id,token); return ResponseEntity.ok(Map.of("error",0)); }
        catch (Exception e) { return ResponseEntity.status(403).body(Map.of("error",1)); }
    }
    private ResponseEntity<?> ok(Object value) { return ResponseEntity.ok().header("Cache-Control","no-store").body(ApiResponse.success(value,"Thành công")); }
}

package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.service.HrDocumentTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
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
    @GetMapping("/{kind}/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable String kind,@PathVariable String id) {
        var file = "active".equals(id) ? service.active(kind) : service.download(kind,id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
            .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(file.fileName(),StandardCharsets.UTF_8).build().toString())
            .header(HttpHeaders.CACHE_CONTROL,"no-store").body(file.bytes());
    }
    @PostMapping(value="/{kind}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<String> upload(@PathVariable String kind,@RequestPart MultipartFile file,@RequestParam String note,
                                     @AuthenticationPrincipal User user) throws java.io.IOException {
        if (file.getSize()>15*1024*1024) throw HrApiException.badRequest("TEMPLATE_TOO_LARGE","Mẫu tối đa 15 MB.");
        return ApiResponse.success(service.upload(kind,file.getOriginalFilename(),file.getBytes(),note,actors.fromPrincipal(user)),"Đã lưu phiên bản mẫu, chưa áp dụng");
    }
    @PostMapping("/{kind}/{id}/activate")
    public ApiResponse<Void> activate(@PathVariable String kind,@PathVariable String id,@AuthenticationPrincipal User user) {
        service.activate(kind,id,actors.fromPrincipal(user)); return ApiResponse.success(null,"Đã áp dụng mẫu");
    }
}

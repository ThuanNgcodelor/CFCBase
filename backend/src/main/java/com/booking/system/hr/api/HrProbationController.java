package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrProbationDtos;
import com.booking.system.hr.enums.HrCatalogStatus;
import com.booking.system.hr.enums.HrProbationCandidateStatus;
import com.booking.system.hr.service.HrProbationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hr/probation")
public class HrProbationController {

    private static final int MAX_PAGE_SIZE = 50;
    private static final Map<String, String> CANDIDATE_SORTS = Map.of(
            "candidateCode", "candidateCode",
            "fullName", "fullName",
            "status", "status",
            "probationStartDate", "probationStartDate",
            "probationEndDate", "probationEndDate",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );
    private static final Map<String, String> TEMPLATE_SORTS = Map.of(
            "code", "code",
            "name", "name",
            "sortOrder", "sortOrder",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final HrProbationService probationService;
    private final HrActorResolver actorResolver;

    public HrProbationController(HrProbationService probationService, HrActorResolver actorResolver) {
        this.probationService = probationService;
        this.actorResolver = actorResolver;
    }

    @GetMapping("/candidates")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProbationDtos.CandidateSummary>>> candidates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) HrProbationCandidateStatus status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(defaultValue = "probationEndDate,asc") String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.searchCandidates(
                        keyword, status, departmentId,
                        pageRequest(page, size, sort, CANDIDATE_SORTS, "probationEndDate")),
                "Lấy danh sách ứng viên thử việc thành công"));
    }

    @PostMapping("/candidates")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> createCandidate(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrProbationDtos.CandidateInput request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.createCandidate(request, actorResolver.fromPrincipal(principal)),
                "Tạo ứng viên thử việc thành công"));
    }

    @GetMapping("/candidates/{candidateId}")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> candidate(@PathVariable String candidateId) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.getCandidate(candidateId),
                "Lấy chi tiết ứng viên thử việc thành công"));
    }

    @PatchMapping("/candidates/{candidateId}")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> updateCandidate(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody HrProbationDtos.UpdateCandidateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.updateCandidate(candidateId, request, actorResolver.fromPrincipal(principal)),
                "Cập nhật ứng viên thử việc thành công"));
    }

    @PostMapping("/candidates/{candidateId}/contracts")
    public ResponseEntity<ApiResponse<HrProbationDtos.ContractSummary>> generateContract(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody(required = false) HrProbationDtos.GenerateContractRequest request
    ) {
        HrProbationDtos.GenerateContractRequest safeRequest = request == null
                ? new HrProbationDtos.GenerateContractRequest(null, null)
                : request;
        return ResponseEntity.ok(ApiResponse.success(
                probationService.generateContract(candidateId, safeRequest, actorResolver.fromPrincipal(principal)),
                "Tạo hợp đồng thử việc thành công"));
    }

    @GetMapping("/contracts/{contractId}/download")
    public ResponseEntity<byte[]> downloadContract(@PathVariable String contractId) {
        HrProbationDtos.ContractFile file = probationService.downloadContract(contractId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(file.bytes());
    }

    @PostMapping("/candidates/{candidateId}/start")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> startProbation(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody HrProbationDtos.CandidateActionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.startProbation(candidateId, request, actorResolver.fromPrincipal(principal)),
                "Đã chuyển ứng viên sang trạng thái đang thử việc"));
    }

    @PostMapping("/candidates/{candidateId}/pass")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> markPassed(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody HrProbationDtos.CandidateActionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.markPassed(candidateId, request, actorResolver.fromPrincipal(principal)),
                "Đã đánh dấu đạt thử việc"));
    }

    @PostMapping("/candidates/{candidateId}/fail")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> markFailed(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody HrProbationDtos.CandidateActionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.markFailed(candidateId, request, actorResolver.fromPrincipal(principal)),
                "Đã đánh dấu không đạt thử việc"));
    }

    @PostMapping("/candidates/{candidateId}/convert-to-employee-draft")
    public ResponseEntity<ApiResponse<HrProbationDtos.CandidateDetail>> convertToEmployeeDraft(
            @AuthenticationPrincipal User principal,
            @PathVariable String candidateId,
            @Valid @RequestBody HrProbationDtos.ConvertToEmployeeDraftRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.convertToEmployeeDraft(candidateId, request, actorResolver.fromPrincipal(principal)),
                "Đã chuyển ứng viên thành hồ sơ chờ chính thức"));
    }

    @GetMapping("/job-templates")
    public ResponseEntity<ApiResponse<HrPageResponse<HrProbationDtos.JobTemplateSummary>>> jobTemplates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) HrCatalogStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "sortOrder,asc") String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.searchJobTemplates(
                        status, keyword, pageRequest(page, size, sort, TEMPLATE_SORTS, "sortOrder")),
                "Lấy mẫu công việc thử việc thành công"));
    }

    @PostMapping("/job-templates")
    public ResponseEntity<ApiResponse<HrProbationDtos.JobTemplateSummary>> createJobTemplate(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrProbationDtos.JobTemplateInput request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.createJobTemplate(request, actorResolver.fromPrincipal(principal)),
                "Tạo mẫu công việc thử việc thành công"));
    }

    @PatchMapping("/job-templates/{templateId}")
    public ResponseEntity<ApiResponse<HrProbationDtos.JobTemplateSummary>> updateJobTemplate(
            @AuthenticationPrincipal User principal,
            @PathVariable String templateId,
            @Valid @RequestBody HrProbationDtos.UpdateJobTemplateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                probationService.updateJobTemplate(templateId, request, actorResolver.fromPrincipal(principal)),
                "Cập nhật mẫu công việc thử việc thành công"));
    }

    private static PageRequest pageRequest(
            int page,
            int size,
            String requestedSort,
            Map<String, String> allowlist,
            String defaultSort
    ) {
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? 20 : Math.min(size, MAX_PAGE_SIZE);
        String[] parts = requestedSort == null ? new String[0] : requestedSort.split(",", -1);
        String publicField = parts.length == 0 || parts[0].isBlank() ? defaultSort : parts[0].trim();
        String entityField = allowlist.get(publicField);
        if (entityField == null) {
            throw HrApiException.badRequest("SORT_FIELD_NOT_ALLOWED", "Trường sắp xếp không được hỗ trợ.");
        }
        String directionValue = parts.length < 2 ? "asc" : parts[1].trim().toLowerCase(Locale.ROOT);
        if (!"asc".equals(directionValue) && !"desc".equals(directionValue)) {
            throw HrApiException.badRequest("SORT_DIRECTION_INVALID", "Chiều sắp xếp phải là asc hoặc desc.");
        }
        if (parts.length > 2) {
            throw HrApiException.badRequest("SORT_INVALID", "Mỗi yêu cầu chỉ hỗ trợ một trường sắp xếp.");
        }
        Sort.Direction direction = "desc".equals(directionValue) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return PageRequest.of(safePage, safeSize, Sort.by(direction, entityField));
    }
}

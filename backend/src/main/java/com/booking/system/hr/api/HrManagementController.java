package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.entity.User;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.enums.HrCatalogStatus;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.service.HrManagementService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

@RestController
@RequestMapping("/api/v1/hr")
public class HrManagementController {

    private static final int MAX_PAGE_SIZE = 50;
    private static final Map<String, String> EMPLOYEE_SORTS = Map.of(
            "employeeCode", "employeeCode",
            "fullName", "fullName",
            "hireDate", "employment.hireDate",
            "employmentStatus", "employmentStatus",
            "statusEffectiveDate", "statusEffectiveDate",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );
    private static final Map<String, String> CATALOG_SORTS = Map.of(
            "code", "code",
            "name", "name",
            "sortOrder", "sortOrder",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final HrManagementService managementService;
    private final HrActorResolver actorResolver;

    public HrManagementController(HrManagementService managementService, HrActorResolver actorResolver) {
        this.managementService = managementService;
        this.actorResolver = actorResolver;
    }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<HrApiDtos.OverviewResponse>> overview() {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.overview(), "Lấy tổng quan nhân sự thành công"));
    }

    @GetMapping("/employees")
    public ResponseEntity<ApiResponse<HrPageResponse<HrApiDtos.EmployeeListItem>>> employees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) HrEmploymentStatus status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String positionId,
            @RequestParam(required = false) String workingConditionId,
            @RequestParam(defaultValue = "employeeCode,asc") String sort
    ) {
        Page<HrApiDtos.EmployeeListItem> result = managementService.searchEmployees(
                keyword, status, departmentId, positionId, workingConditionId,
                pageRequest(page, size, sort, EMPLOYEE_SORTS, "employeeCode"));
        return ResponseEntity.ok(ApiResponse.success(
                HrPageResponse.from(result, Function.identity()), "Lấy danh sách nhân sự thành công"));
    }

    @GetMapping("/employees/{employeeId}")
    public ResponseEntity<ApiResponse<HrApiDtos.EmployeeDetail>> employee(@PathVariable String employeeId) {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.getEmployee(employeeId), "Lấy chi tiết nhân sự thành công"));
    }

    @PostMapping("/employees")
    public ResponseEntity<ApiResponse<HrApiDtos.EmployeeDetail>> createEmployee(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody HrApiDtos.CreateEmployeeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.createEmployee(request, actorResolver.fromPrincipal(principal)),
                "Tạo hồ sơ nhân sự nháp thành công"));
    }

    @PatchMapping("/employees/{employeeId}")
    public ResponseEntity<ApiResponse<HrApiDtos.EmployeeDetail>> updateEmployee(
            @AuthenticationPrincipal User principal,
            @PathVariable String employeeId,
            @Valid @RequestBody HrApiDtos.UpdateEmployeeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.updateEmployee(employeeId, request, actorResolver.fromPrincipal(principal)),
                "Cập nhật hồ sơ nhân sự thành công"));
    }

    @GetMapping("/catalogs/{type}")
    public ResponseEntity<ApiResponse<HrPageResponse<HrApiDtos.CatalogResponse>>> catalogs(
            @PathVariable String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) HrCatalogStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "sortOrder,asc") String sort
    ) {
        Page<HrApiDtos.CatalogResponse> result = managementService.searchCatalog(
                type, status, keyword, pageRequest(page, size, sort, CATALOG_SORTS, "sortOrder"));
        return ResponseEntity.ok(ApiResponse.success(
                HrPageResponse.from(result, Function.identity()), "Lấy danh mục HR thành công"));
    }

    @PostMapping("/catalogs/{type}")
    public ResponseEntity<ApiResponse<HrApiDtos.CatalogResponse>> createCatalog(
            @AuthenticationPrincipal User principal,
            @PathVariable String type,
            @Valid @RequestBody HrApiDtos.CreateCatalogRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.createCatalog(type, request, actorResolver.fromPrincipal(principal)),
                "Tạo danh mục HR thành công"));
    }

    @PatchMapping("/catalogs/{type}/{catalogId}")
    public ResponseEntity<ApiResponse<HrApiDtos.CatalogResponse>> updateCatalog(
            @AuthenticationPrincipal User principal,
            @PathVariable String type,
            @PathVariable String catalogId,
            @Valid @RequestBody HrApiDtos.UpdateCatalogRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                managementService.updateCatalog(type, catalogId, request, actorResolver.fromPrincipal(principal)),
                "Cập nhật danh mục HR thành công"));
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

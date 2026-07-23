package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.hr.api.dto.HrAuditEventResponse;
import com.booking.system.hr.api.dto.HrMovementResponse;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrRosterItemResponse;
import com.booking.system.hr.api.dto.HrRosterResponse;
import com.booking.system.hr.service.HrExcelExportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hr")
public class HrActivityController {

    private final HrActivityQueryService queryService;
    private final HrExcelExportService exportService;

    public HrActivityController(HrActivityQueryService queryService, HrExcelExportService exportService) {
        this.queryService = queryService;
        this.exportService = exportService;
    }

    @GetMapping("/movements")
    public ResponseEntity<ApiResponse<HrPageResponse<HrMovementResponse>>> movements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.movements(page, size),
                "Lấy lịch sử biến động nhân sự thành công"
        ));
    }

    @GetMapping("/rosters")
    public ResponseEntity<ApiResponse<HrPageResponse<HrRosterResponse>>> rosters(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.rosters(page, size),
                "Lấy danh sách kỳ nhân sự thành công"
        ));
    }

    @GetMapping("/rosters/{rosterId}")
    public ResponseEntity<ApiResponse<HrRosterResponse>> roster(@PathVariable String rosterId) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.roster(rosterId),
                "Lấy thông tin kỳ nhân sự thành công"
        ));
    }

    @GetMapping("/rosters/{rosterId}/items")
    public ResponseEntity<ApiResponse<HrPageResponse<HrRosterItemResponse>>> rosterItems(
            @PathVariable String rosterId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.rosterItems(rosterId, page, size),
                "Lấy chi tiết danh sách nhân sự tháng thành công"
        ));
    }

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<HrPageResponse<HrAuditEventResponse>>> auditEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.auditEvents(page, size),
                "Lấy nhật ký HR thành công"
        ));
    }

    @GetMapping("/exports/month")
    public ResponseEntity<byte[]> exportMonth(
            @RequestParam int year,
            @RequestParam int month
    ) {
        return exportResponse(exportService.exportMonth(year, month));
    }

    @GetMapping("/exports/year")
    public ResponseEntity<byte[]> exportYear(@RequestParam int year) {
        return exportResponse(exportService.exportYear(year));
    }

    private static ResponseEntity<byte[]> exportResponse(HrExcelExportService.ExportFile file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName())
                        .build()
                        .toString())
                .body(file.content());
    }
}

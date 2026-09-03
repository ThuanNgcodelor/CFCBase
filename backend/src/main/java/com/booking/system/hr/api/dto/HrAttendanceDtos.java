package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.HrAttendanceImportStatus;
import com.booking.system.hr.enums.HrAttendanceRecordStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class HrAttendanceDtos {
    private HrAttendanceDtos() {}

    public record Config(
            @Min(1) @Max(30) int headerRow,
            @NotBlank String employeeCodeColumn,
            @NotBlank String employeeNameColumn,
            @NotBlank String dateColumn,
            List<String> punchColumns,
            LocalTime checkInStart,
            LocalTime checkInEnd,
            LocalTime checkOutStart,
            LocalTime checkOutEnd,
            LocalTime defaultCheckIn,
            LocalTime defaultCheckOut,
            LocalTime standardCheckIn,
            LocalTime standardCheckOut,
            @Min(0) @Max(120) int graceMinutes,
            List<String> excludedEmployeeCodes
    ) {
        public Config(int headerRow, String employeeCodeColumn, String employeeNameColumn, String dateColumn,
                      List<String> punchColumns, LocalTime checkInStart, LocalTime checkInEnd,
                      LocalTime checkOutStart, LocalTime checkOutEnd, LocalTime defaultCheckIn,
                      LocalTime defaultCheckOut, LocalTime standardCheckIn, LocalTime standardCheckOut,
                      int graceMinutes) {
            this(headerRow, employeeCodeColumn, employeeNameColumn, dateColumn, punchColumns,
                    checkInStart, checkInEnd, checkOutStart, checkOutEnd, defaultCheckIn, defaultCheckOut,
                    standardCheckIn, standardCheckOut, graceMinutes, List.of());
        }
    }

    public record ImportResponse(String id, String fileName, String sheetName, String attendanceMonth,
                                 HrAttendanceImportStatus status, Config configuration, int totalRows,
                                 int validRows, int errorRows, int excludedRows, String lastError, LocalDateTime createdAt) {}

    public record RecordResponse(String id, int sourceRowNumber, String employeeCode, String employeeName,
                                 LocalDate workDate, List<String> punches, LocalTime checkIn, LocalTime checkOut,
                                 BigDecimal workValue, int lateMinutes, int earlyMinutes,
                                 HrAttendanceRecordStatus status, String errorMessage) {}

    public record PreviewResponse(ImportResponse batch, HrPageResponse<RecordResponse> rows) {}

    public record BatchImportResponse(List<ImportResponse> imports, int totalFiles, int totalRows,
                                      int validRows, int excludedRows, int errorRows) {}
}

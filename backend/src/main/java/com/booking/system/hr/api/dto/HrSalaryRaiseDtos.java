package com.booking.system.hr.api.dto;

import com.booking.system.hr.entity.HrEmployeeSalaryChange;
import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.enums.HrImportBatchStatus;
import com.booking.system.hr.enums.HrImportRowStatus;
import com.booking.system.hr.enums.HrSalaryChangeStatus;
import com.booking.system.hr.enums.HrSalaryReviewStatus;
import com.booking.system.hr.importer.HrImportIssue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class HrSalaryRaiseDtos {
    private HrSalaryRaiseDtos() {
    }

    public record BatchResponse(
            String id,
            String sourceFileName,
            String sourceSheetName,
            Short sourcePeriodYear,
            Byte sourcePeriodMonth,
            HrImportBatchStatus status,
            int totalRows,
            int validRows,
            int warningRows,
            int invalidRows,
            int importedRows,
            LocalDateTime parsedAt,
            LocalDateTime validatedAt,
            LocalDateTime confirmedAt,
            LocalDateTime rolledBackAt,
            LocalDateTime createdAt
    ) {
        public static BatchResponse from(HrExcelImportBatch value) {
            return new BatchResponse(value.getId(), value.getSourceFileName(), value.getSourceSheetName(),
                    value.getSourcePeriodYear(), value.getSourcePeriodMonth(), value.getStatus(), value.getTotalRows(),
                    value.getValidRows(), value.getWarningRows(), value.getInvalidRows(), value.getImportedRows(),
                    value.getParsedAt(), value.getValidatedAt(), value.getConfirmedAt(), value.getRolledBackAt(),
                    value.getCreatedAt());
        }
    }

    public record RowData(
            int sourceRowNumber,
            String employeeCode,
            String fullName,
            BigDecimal currentBaseSalary,
            BigDecimal currentAllowance,
            BigDecimal currentTotal,
            String currentGrade,
            String salaryScaleCode,
            String newGrade,
            BigDecimal newBaseSalary,
            BigDecimal newAllowance,
            BigDecimal newTotal,
            Integer reviewCycleMonths,
            LocalDate effectiveDate,
            LocalDate nextReviewDate,
            String matchedEmployeeId,
            String matchedEmployeeName,
            BigDecimal databaseBaseSalary,
            BigDecimal databaseAllowance
    ) {
        public RowData withDatabase(String employeeId, String employeeName,
                                    BigDecimal baseSalary, BigDecimal allowance) {
            return new RowData(sourceRowNumber, employeeCode, fullName, currentBaseSalary, currentAllowance,
                    currentTotal, currentGrade, salaryScaleCode, newGrade, newBaseSalary, newAllowance, newTotal,
                    reviewCycleMonths, effectiveDate, nextReviewDate, employeeId, employeeName,
                    baseSalary, allowance);
        }
    }

    public record PreviewRow(int sourceRowNumber, HrImportRowStatus status,
                             RowData data, List<HrImportIssue> issues) {
    }

    public record PreviewResponse(BatchResponse batch, List<PreviewRow> rows,
                                  int page, int size, long totalElements, int totalPages) {
    }

    public record HistoryResponse(
            String id,
            String importBatchId,
            LocalDate effectiveDate,
            HrSalaryChangeStatus status,
            BigDecimal oldBaseSalary,
            BigDecimal newBaseSalary,
            BigDecimal oldAllowance,
            BigDecimal newAllowance,
            String oldGrade,
            String newGrade,
            String salaryScaleCode,
            Integer reviewCycleMonths,
            LocalDate nextReviewDate,
            LocalDateTime appliedAt,
            LocalDateTime rolledBackAt,
            String rollbackReason,
            LocalDateTime createdAt,
            String createdByActor
    ) {
        public static HistoryResponse from(HrEmployeeSalaryChange value) {
            return new HistoryResponse(value.getId(),
                    value.getImportBatch() == null ? null : value.getImportBatch().getId(),
                    value.getEffectiveDate(), value.getStatus(), value.getOldBaseSalary(), value.getNewBaseSalary(),
                    value.getOldAllowance(), value.getNewAllowance(), value.getOldGrade(), value.getNewGrade(),
                    value.getSalaryScaleCode(), value.getReviewCycleMonths(), value.getNextReviewDate(),
                    value.getAppliedAt(), value.getRolledBackAt(), value.getRollbackReason(), value.getCreatedAt(),
                    value.getCreatedByActor());
        }
    }

    public record RollbackRequest(
            @NotBlank(message = "Lý do rollback là bắt buộc")
            @Size(max = 1000, message = "Lý do rollback không được quá 1000 ký tự")
            String reason
    ) {
    }

    public record ReviewStats(
            long totalEmployees,
            long overdue,
            long due30,
            long due60,
            long due90,
            long later,
            long missing,
            long resolved
    ) {
    }

    public record ReviewItem(
            String employeeId,
            String employeeCode,
            String fullName,
            String departmentId,
            String departmentName,
            String positionName,
            BigDecimal baseSalary,
            BigDecimal allowance,
            String salaryGrade,
            String salaryScaleCode,
            Integer reviewCycleMonths,
            LocalDate lastSalaryRaiseDate,
            LocalDate nextSalaryReviewDate,
            LocalDate effectiveReviewDate,
            Long daysUntilDue,
            HrSalaryReviewStatus reviewStatus,
            LocalDate followUpDate,
            String note,
            LocalDateTime statusUpdatedAt,
            String statusUpdatedByActor,
            long rowVersion
    ) {
    }

    public record ReviewDashboardResponse(
            LocalDate asOf,
            ReviewStats stats,
            HrPageResponse<ReviewItem> employees
    ) {
    }

    public record ReviewUpdateRequest(
            @NotNull(message = "Trạng thái rà soát là bắt buộc")
            HrSalaryReviewStatus status,
            LocalDate followUpDate,
            @Size(max = 1000, message = "Ghi chú không được quá 1000 ký tự")
            String note,
            @PositiveOrZero(message = "Phiên bản dữ liệu không hợp lệ")
            long rowVersion
    ) {
    }
}

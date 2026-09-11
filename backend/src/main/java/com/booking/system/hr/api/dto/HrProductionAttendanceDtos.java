package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class HrProductionAttendanceDtos {
    private HrProductionAttendanceDtos() { }

    public record ShiftPolicyResponse(String id, String code, String name, HrAttendancePolicyGroup policyGroup,
                                      LocalTime standardStart, LocalTime standardEnd, LocalTime checkInFrom,
                                      LocalTime checkInUntil, LocalTime checkOutFrom, LocalTime checkOutUntil,
                                      boolean crossesMidnight, BigDecimal nightAllowanceAmount, int priority,
                                      boolean active, LocalDate validFrom, LocalDate validTo, long rowVersion) { }

    public record UpdateShiftPolicyRequest(@NotBlank String name, @NotNull LocalTime standardStart,
                                           @NotNull LocalTime standardEnd, @NotNull LocalTime checkInFrom,
                                           @NotNull LocalTime checkInUntil, @NotNull LocalTime checkOutFrom,
                                           @NotNull LocalTime checkOutUntil, @NotNull BigDecimal nightAllowanceAmount,
                                           int priority, boolean active, @NotNull LocalDate validFrom,
                                           LocalDate validTo, long rowVersion) { }

    public record CreateEmployeePolicyRequest(@NotBlank String employeeCode,
                                              @NotNull HrAttendancePolicyGroup policyGroup,
                                              @NotNull LocalDate validFrom, LocalDate validTo,
                                              @NotBlank String reason) { }

    public record EmployeePolicyResponse(String id, String employeeCode, HrAttendancePolicyGroup policyGroup,
                                         LocalDate validFrom, LocalDate validTo, String source, String reason) { }

    public record CreateExemptionRequest(@NotBlank String employeeCode, @NotNull LocalDate validFrom,
                                         @NotNull LocalDate validTo, @NotBlank String reason) { }

    public record ExemptionResponse(String id, String employeeCode, LocalDate validFrom, LocalDate validTo,
                                    String reason, HrAttendanceExemptionStatus status,
                                    LocalDateTime confirmedAt, String confirmedByActor,
                                    LocalDateTime cancelledAt, String cancelledByActor, String cancellationReason,
                                    long rowVersion) { }

    public record CancelExemptionRequest(@NotBlank String reason, long rowVersion) { }

    public record ImportResponse(String id, String sourceFileName, String sourceSheetName, String attendanceMonth,
                                 HrAttendanceImportStatus status, int processingVersion, int totalRows,
                                 int totalPunches, int autoMatchedShifts, int reviewShifts, int noPunchRows,
                                 int excludedRows, LocalDateTime createdAt, LocalDateTime confirmedAt) { }

    public record PunchResponse(String id, String employeeCode, String employeeName, LocalDate workDate,
                                LocalDateTime punchedAt, int sourceRowNumber, String sourceColumn,
                                String rawValue) { }

    public record ShiftResponse(String id, String importId, String employeeCode, String employeeName,
                                LocalDate workDate, int calculationVersion, HrAttendancePolicyGroup policyGroup,
                                String shiftCode, LocalDateTime checkInAt, LocalDateTime checkOutAt,
                                BigDecimal workValue, BigDecimal nightAllowanceAmount,
                                HrProductionAttendanceShiftStatus status, HrAttendanceResolutionType resolutionType,
                                String explanation, String incidentId, LocalDateTime confirmedAt,
                                String confirmedByActor, long rowVersion) { }

    public record ShiftDecisionRequest(@NotNull DecisionAction action, String shiftCode,
                                       String checkInPunchId, String checkOutPunchId,
                                       @NotNull BigDecimal workValue, @NotNull BigDecimal nightAllowanceAmount,
                                       @NotBlank String reason, long rowVersion) { }

    public record ShiftAdjustmentResponse(String id, String shiftId, String beforeJson, String afterJson,
                                          String reason, LocalDateTime createdAt, String createdByActor) { }

    public enum DecisionAction { CONFIRM, REJECT }

    public record BulkConfirmRequest(@NotEmpty List<@NotBlank String> shiftIds,
                                     @NotBlank String reason) { }

    public record CreateIncidentRequest(@NotNull LocalDateTime startedAt, @NotNull LocalDateTime endedAt,
                                        @NotNull HrAttendanceIncidentScopeType scopeType,
                                        List<String> scopeValues, @NotBlank String description) { }

    public record IncidentResponse(String id, LocalDateTime startedAt, LocalDateTime endedAt,
                                   HrAttendanceIncidentScopeType scopeType, List<String> scopeValues,
                                   String description, HrAttendanceIncidentStatus status,
                                   LocalDateTime confirmedAt, String confirmedByActor) { }

    public record IncidentCandidate(String shiftId, String employeeCode, LocalDate workDate, String shiftCode,
                                    LocalDateTime actualCheckIn, LocalDateTime actualCheckOut,
                                    LocalDateTime missingExpectedAt, BigDecimal proposedWorkValue,
                                    BigDecimal proposedNightAllowance, String explanation) { }

    public record IncidentSelection(@NotBlank String shiftId, @NotNull BigDecimal workValue,
                                    @NotNull BigDecimal nightAllowanceAmount) { }

    public record ConfirmIncidentRequest(@NotEmpty List<@Valid IncidentSelection> selections,
                                         @NotBlank String reason) { }
}

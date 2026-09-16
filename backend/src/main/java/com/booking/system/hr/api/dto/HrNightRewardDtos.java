package com.booking.system.hr.api.dto;

import com.booking.system.hr.enums.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class HrNightRewardDtos {
    private HrNightRewardDtos() { }

    public record ProgramResponse(String id, String code, String name, LocalDate effectiveFrom,
                                  LocalDate effectiveTo, int qualifyingNightThreshold,
                                  HrAttendancePolicyGroup eligiblePolicyGroup, boolean active) { }

    public record SourceShiftResponse(String shiftId, String importId, LocalDate workDate,
                                      String shiftCode, String status, String resolutionType) { }

    public record ProgressResponse(int periodicQualifiedMonths, int periodicRequiredMonths,
                                   int loyaltyQualifiedMonths, int loyaltyRequiredMonths,
                                   int draftPeriodicEntitlements, int draftLoyaltyEntitlements) { }

    public record MonthlyEmployeeResponse(String employeeCode, String employeeName, String employeeId,
                                          int actualNightShiftCount, int requiredNightShiftCount,
                                          HrNightRewardMonthlyStatus calculatedStatus,
                                          String calculatedReason, boolean hasApprovedException,
                                          HrNightRewardMonthlyStatus finalizedStatus,
                                          Integer finalizedRevision, ProgressResponse progress,
                                          List<SourceShiftResponse> sourceShifts) { }

    public record MonthResponse(String attendanceMonth, boolean readyToFinalize, List<String> blockers,
                                ProgramResponse program, int eligibleEmployees, int qualifiedEmployees,
                                int notQualifiedEmployees, int exceptionEmployees,
                                List<MonthlyEmployeeResponse> employees) { }

    public record FinalizeMonthRequest(@NotBlank String reason) { }

    public record FinalizeMonthResponse(String attendanceMonth, int createdQualifications,
                                        int unchangedQualifications, int qualifiedEmployees,
                                        int exceptionEmployees, List<String> createdEntitlementIds) { }

    public record CreateExceptionRequest(@NotBlank String employeeCode, @NotBlank String attendanceMonth,
                                         @NotNull HrNightRewardExceptionType exceptionType,
                                         @NotBlank String reason, String evidenceReference) { }

    public record ReviewExceptionRequest(@NotBlank String reason) { }

    public record ExceptionResponse(String id, String employeeCode, String attendanceMonth,
                                    HrNightRewardExceptionType exceptionType,
                                    HrNightRewardExceptionStatus status, String reason,
                                    String evidenceReference, LocalDateTime createdAt,
                                    LocalDateTime reviewedAt, String reviewedByActor,
                                    String reviewReason, LocalDateTime cancelledAt,
                                    String cancelledByActor, String cancellationReason,
                                    long rowVersion) { }

    public record QualificationResponse(String id, String attendanceMonth, int revision,
                                        HrNightRewardMonthlyStatus status, int actualNightShiftCount,
                                        int requiredNightShiftCount, String qualificationReason,
                                        LocalDateTime finalizedAt, String finalizedByActor,
                                        LocalDateTime staleAt, String staleReason,
                                        List<SourceShiftResponse> sourceShifts) { }

    public record EntitlementResponse(String id, HrNightRewardTrack track, int qualifiedMonthsAtMaturity,
                                      BigDecimal amount, HrNightRewardEntitlementStatus status,
                                      LocalDateTime createdAt) { }

    public record EmployeeTimelineResponse(String employeeCode, String employeeName,
                                           ProgramResponse program, ProgressResponse progress,
                                           List<QualificationResponse> qualifications,
                                           List<EntitlementResponse> entitlements) { }
}

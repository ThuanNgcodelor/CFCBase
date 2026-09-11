package com.booking.system.hr.service;

import com.booking.system.hr.enums.HrAttendancePolicyGroup;
import com.booking.system.hr.enums.HrAttendanceResolutionType;
import com.booking.system.hr.enums.HrProductionAttendanceShiftStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Component
public class HrProductionShiftMatcher {

    public List<MatchResult> match(List<WorkDay> sourceDays, List<ShiftPolicy> policies,
                                   List<CreditRule> creditRules) {
        return match(sourceDays, List.of(), policies, creditRules);
    }

    public List<MatchResult> match(List<WorkDay> sourceDays, List<Punch> supplementalPunches,
                                   List<ShiftPolicy> policies, List<CreditRule> creditRules) {
        List<WorkDay> days = sourceDays.stream()
                .sorted(Comparator.comparing(WorkDay::date).thenComparingInt(WorkDay::sourceRowNumber))
                .toList();
        Map<LocalDate, List<Punch>> byDate = new HashMap<>();
        for (WorkDay day : days) {
            byDate.computeIfAbsent(day.date(), ignored -> new ArrayList<>()).addAll(day.punches());
        }
        for (Punch punch : supplementalPunches) {
            byDate.computeIfAbsent(punch.punchedAt().toLocalDate(), ignored -> new ArrayList<>()).add(punch);
        }
        byDate.values().forEach(values -> values.sort(Comparator.comparing(Punch::punchedAt)));
        List<ShiftPolicy> orderedPolicies = policies.stream()
                .sorted(Comparator.comparingInt(ShiftPolicy::priority).reversed().thenComparing(ShiftPolicy::code))
                .toList();
        Set<String> usedPunches = new HashSet<>();
        List<MatchResult> results = new ArrayList<>();

        for (WorkDay day : days) {
            if (day.excluded()) {
                results.add(empty(day, HrProductionAttendanceShiftStatus.EXCLUDED,
                        HrAttendanceResolutionType.EXEMPTION, "Nhân viên được miễn chấm trong ngày này."));
                continue;
            }
            List<Punch> sameDay = available(byDate.getOrDefault(day.date(), List.of()), usedPunches);
            Candidate selected = findSameDay(day.date(), sameDay, orderedPolicies, creditRules);
            if (selected == null) {
                selected = findCrossMidnight(day.date(), sameDay,
                        available(byDate.getOrDefault(day.date().plusDays(1), List.of()), usedPunches),
                        orderedPolicies, creditRules);
            }
            if (selected != null) {
                usedPunches.add(selected.checkIn().id());
                usedPunches.add(selected.checkOut().id());
                int unusedOnRow = (int) day.punches().stream().filter(p -> !usedPunches.contains(p.id())).count();
                HrProductionAttendanceShiftStatus status = unusedOnRow == 0
                        ? HrProductionAttendanceShiftStatus.AUTO_MATCHED
                        : HrProductionAttendanceShiftStatus.NEEDS_REVIEW;
                String explanation = unusedOnRow == 0
                        ? "Ghép tự động theo cửa giờ ca " + selected.policy().code() + "."
                        : "Đã tìm được ca " + selected.policy().code() + " nhưng còn " + unusedOnRow + " dấu chấm chưa dùng; cần kiểm tra.";
                HrAttendanceResolutionType resolution = selected.checkOut().punchedAt().toLocalDate().getMonth()
                        != selected.checkIn().punchedAt().toLocalDate().getMonth()
                        ? HrAttendanceResolutionType.MONTH_BOUNDARY : HrAttendanceResolutionType.NORMAL;
                results.add(result(day, selected, status, resolution, explanation));
                continue;
            }

            if (day.punches().isEmpty()) {
                MatchResult missingCheckIn = missingCrossMidnightCheckIn(day,
                        available(byDate.getOrDefault(day.date().plusDays(1), List.of()), usedPunches),
                        orderedPolicies, creditRules);
                if (missingCheckIn != null) {
                    usedPunches.add(missingCheckIn.checkOutPunchId());
                    results.add(missingCheckIn);
                    continue;
                }
            }

            List<Punch> remaining = available(day.punches(), usedPunches);
            if (remaining.isEmpty()) {
                results.add(empty(day, HrProductionAttendanceShiftStatus.NO_PUNCH,
                        HrAttendanceResolutionType.NORMAL, "Không có dấu chấm chưa sử dụng trong ngày."));
            } else {
                results.add(missingPunch(day, remaining, orderedPolicies, creditRules));
            }
        }
        return List.copyOf(results);
    }

    private MatchResult missingCrossMidnightCheckIn(WorkDay day, List<Punch> nextDay,
                                                     List<ShiftPolicy> policies, List<CreditRule> rules) {
        for (ShiftPolicy policy : policies) {
            if (!policy.crossesMidnight()) continue;
            if (!effective(policy.validFrom(), policy.validTo(), day.date())) continue;
            List<Punch> outputs = nextDay.stream()
                    .filter(p -> inRange(p.punchedAt().toLocalTime(), policy.checkOutFrom(), policy.checkOutUntil()))
                    .toList();
            if (outputs.size() != 1) continue;
            CreditRule rule = credit(policy, rules, day.date(), outputs.get(0).punchedAt().toLocalTime());
            if (rule == null) continue;
            Punch output = outputs.get(0);
            return new MatchResult(day.sourceRowNumber(), day.date(), policy.id(), policy.code(), rule.id(),
                    null, output.id(), null, output.punchedAt(), rule.workValue(), policy.nightAllowanceAmount(),
                    HrProductionAttendanceShiftStatus.NEEDS_REVIEW, HrAttendanceResolutionType.MISSING_PUNCH,
                    "Có lượt ra sáng hôm sau nhưng thiếu lượt vào ca " + policy.code() + "; chưa tạo giờ chấm giả.");
        }
        return null;
    }

    private Candidate findSameDay(LocalDate date, List<Punch> punches, List<ShiftPolicy> policies,
                                  List<CreditRule> rules) {
        List<Candidate> candidates = new ArrayList<>();
        for (ShiftPolicy policy : policies) {
            if (!effective(policy.validFrom(), policy.validTo(), date)) continue;
            if (policy.crossesMidnight()) continue;
            Punch checkIn = punches.stream().filter(p -> inRange(p.punchedAt().toLocalTime(), policy.checkInFrom(), policy.checkInUntil()))
                    .min(Comparator.comparing(Punch::punchedAt)).orElse(null);
            Punch checkOut = punches.stream().filter(p -> inRange(p.punchedAt().toLocalTime(), policy.checkOutFrom(), policy.checkOutUntil()))
                    .max(Comparator.comparing(Punch::punchedAt)).orElse(null);
            if (checkIn != null && checkOut != null && checkOut.punchedAt().isAfter(checkIn.punchedAt())) {
                CreditRule rule = credit(policy, rules, date, checkOut.punchedAt().toLocalTime());
                if (rule != null) candidates.add(new Candidate(policy, rule, checkIn, checkOut));
            }
        }
        return uniqueBest(candidates);
    }

    private Candidate findCrossMidnight(LocalDate date, List<Punch> starts, List<Punch> nextDay,
                                        List<ShiftPolicy> policies, List<CreditRule> rules) {
        List<Candidate> candidates = new ArrayList<>();
        for (ShiftPolicy policy : policies) {
            if (!effective(policy.validFrom(), policy.validTo(), date)) continue;
            if (!policy.crossesMidnight()) continue;
            Punch checkIn = starts.stream().filter(p -> inRange(p.punchedAt().toLocalTime(), policy.checkInFrom(), policy.checkInUntil()))
                    .min(Comparator.comparing(Punch::punchedAt)).orElse(null);
            Punch checkOut = nextDay.stream().filter(p -> inRange(p.punchedAt().toLocalTime(), policy.checkOutFrom(), policy.checkOutUntil()))
                    .max(Comparator.comparing(Punch::punchedAt)).orElse(null);
            if (checkIn != null && checkOut != null && checkOut.punchedAt().isAfter(checkIn.punchedAt())) {
                CreditRule rule = credit(policy, rules, date, checkOut.punchedAt().toLocalTime());
                if (rule != null) candidates.add(new Candidate(policy, rule, checkIn, checkOut));
            }
        }
        return uniqueBest(candidates);
    }

    private MatchResult missingPunch(WorkDay day, List<Punch> remaining, List<ShiftPolicy> policies,
                                     List<CreditRule> rules) {
        Punch first = remaining.stream().min(Comparator.comparing(Punch::punchedAt)).orElseThrow();
        List<ShiftPolicy> startingPolicies = policies.stream()
                .filter(policy -> effective(policy.validFrom(), policy.validTo(), day.date()))
                .filter(policy -> inRange(first.punchedAt().toLocalTime(), policy.checkInFrom(), policy.checkInUntil()))
                .toList();
        ShiftPolicy proposal = startingPolicies.size() == 1 ? startingPolicies.get(0) : null;
        if (proposal == null && !startingPolicies.isEmpty()) proposal = startingPolicies.get(0);
        BigDecimal workValue = BigDecimal.ZERO;
        String ruleId = null;
        BigDecimal allowance = BigDecimal.ZERO;
        if (proposal != null && proposal.crossesMidnight()) {
            ShiftPolicy proposedPolicy = proposal;
            CreditRule rule = rules.stream().filter(value -> value.shiftPolicyId().equals(proposedPolicy.id()))
                    .filter(value -> effective(value.validFrom(), value.validTo(), day.date()))
                    .max(Comparator.comparingInt(CreditRule::priority)).orElse(null);
            if (rule != null) {
                workValue = rule.workValue();
                ruleId = rule.id();
                allowance = proposal.nightAllowanceAmount();
            }
        }
        return new MatchResult(day.sourceRowNumber(), day.date(), proposal == null ? null : proposal.id(),
                proposal == null ? null : proposal.code(), ruleId, first.id(), null, first.punchedAt(), null,
                workValue, allowance, HrProductionAttendanceShiftStatus.NEEDS_REVIEW,
                HrAttendanceResolutionType.MISSING_PUNCH,
                proposal == null
                        ? "Có dấu chấm nhưng không ghép được một ca duy nhất."
                        : "Thiếu lượt ra cho ca đề xuất " + proposal.code() + "; chưa tạo giờ chấm giả.");
    }

    private static Candidate uniqueBest(List<Candidate> candidates) {
        if (candidates.isEmpty()) return null;
        candidates.sort(Comparator.comparingInt((Candidate value) -> value.policy().priority()).reversed()
                .thenComparing(value -> value.policy().code()));
        return candidates.get(0);
    }

    private static CreditRule credit(ShiftPolicy policy, List<CreditRule> rules, LocalDate date, LocalTime checkout) {
        return rules.stream()
                .filter(rule -> rule.shiftPolicyId().equals(policy.id()))
                .filter(rule -> effective(rule.validFrom(), rule.validTo(), date))
                .filter(rule -> inRange(checkout, rule.checkOutFrom(), rule.checkOutUntil()))
                .max(Comparator.comparingInt(CreditRule::priority)).orElse(null);
    }

    private static List<Punch> available(List<Punch> values, Set<String> used) {
        return values.stream().filter(value -> !used.contains(value.id())).toList();
    }

    private static boolean inRange(LocalTime value, LocalTime from, LocalTime until) {
        return value != null && !value.isBefore(from) && !value.isAfter(until);
    }

    private static boolean effective(LocalDate from, LocalDate until, LocalDate date) {
        return !date.isBefore(from) && (until == null || !date.isAfter(until));
    }

    private static MatchResult result(WorkDay day, Candidate candidate,
                                      HrProductionAttendanceShiftStatus status,
                                      HrAttendanceResolutionType resolution, String explanation) {
        return new MatchResult(day.sourceRowNumber(), day.date(), candidate.policy().id(), candidate.policy().code(),
                candidate.rule().id(), candidate.checkIn().id(), candidate.checkOut().id(),
                candidate.checkIn().punchedAt(), candidate.checkOut().punchedAt(), candidate.rule().workValue(),
                candidate.policy().nightAllowanceAmount(), status, resolution, explanation);
    }

    private static MatchResult empty(WorkDay day, HrProductionAttendanceShiftStatus status,
                                     HrAttendanceResolutionType resolution, String explanation) {
        return new MatchResult(day.sourceRowNumber(), day.date(), null, null, null, null, null, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO, status, resolution, explanation);
    }

    private record Candidate(ShiftPolicy policy, CreditRule rule, Punch checkIn, Punch checkOut) { }

    public record Punch(String id, LocalDateTime punchedAt) { }
    public record WorkDay(int sourceRowNumber, LocalDate date, List<Punch> punches, boolean excluded) { }
    public record ShiftPolicy(String id, String code, HrAttendancePolicyGroup group, LocalTime standardStart,
                              LocalTime standardEnd, LocalTime checkInFrom, LocalTime checkInUntil,
                              LocalTime checkOutFrom, LocalTime checkOutUntil, boolean crossesMidnight,
                              BigDecimal nightAllowanceAmount, int priority, LocalDate validFrom,
                              LocalDate validTo) { }
    public record CreditRule(String id, String shiftPolicyId, LocalTime checkOutFrom, LocalTime checkOutUntil,
                             BigDecimal workValue, int priority, LocalDate validFrom, LocalDate validTo) { }
    public record MatchResult(int sourceRowNumber, LocalDate workDate, String shiftPolicyId, String shiftCode,
                              String creditRuleId, String checkInPunchId, String checkOutPunchId,
                              LocalDateTime checkInAt, LocalDateTime checkOutAt, BigDecimal workValue,
                              BigDecimal nightAllowanceAmount, HrProductionAttendanceShiftStatus status,
                              HrAttendanceResolutionType resolutionType, String explanation) { }
}

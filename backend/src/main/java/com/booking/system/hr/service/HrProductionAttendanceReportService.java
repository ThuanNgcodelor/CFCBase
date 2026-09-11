package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrProductionAttendanceDtos;
import com.booking.system.hr.entity.*;
import com.booking.system.hr.enums.*;
import com.booking.system.hr.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HrProductionAttendanceReportService {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final HrProductionAttendanceImportRepository importRepository;
    private final HrProductionAttendanceShiftRepository shiftRepository;
    private final HrAttendancePunchRepository punchRepository;
    private final HrAttendanceShiftAdjustmentRepository adjustmentRepository;
    private final HrEmployeeRepository employeeRepository;

    public HrProductionAttendanceDtos.MonthlySummary monthlySummary(String month) {
        ReportData report = reportData(month);
        return report.summary();
    }

    public ExportFile exportMonthlySummary(String month) {
        ReportData report = reportData(month);
        if (report.confirmedImports().isEmpty()) {
            throw HrApiException.conflict("PRODUCTION_ATTENDANCE_NOT_CONFIRMED",
                    "Chưa có file ca sản xuất đã chốt trong tháng này để xuất Excel.");
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Styles styles = new Styles(workbook);
            writeSummarySheet(workbook, styles, report);
            writeReconciliationSheet(workbook, styles, report);
            workbook.write(output);
            return new ExportFile("BANG_CONG_CA_SAN_XUAT_" + month + ".xlsx", output.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo file bảng công ca sản xuất.", ex);
        }
    }

    private ReportData reportData(String monthValue) {
        String month = parseMonth(monthValue).toString();
        List<HrProductionAttendanceImport> confirmedImports = importRepository
                .findByAttendanceMonthAndStatusOrderByCreatedAtAsc(month, HrAttendanceImportStatus.CONFIRMED);
        List<HrProductionAttendanceImport> previewImports = importRepository
                .findByAttendanceMonthAndStatusOrderByCreatedAtAsc(month, HrAttendanceImportStatus.PREVIEWED);
        List<HrProductionAttendanceShift> allShifts = shiftRepository
                .findActiveByAttendanceMonthAndImportStatus(month, HrAttendanceImportStatus.CONFIRMED);

        Map<String, HrEmployee> employees = employees(allShifts);
        LinkedHashMap<String, HrProductionAttendanceShift> unique = new LinkedHashMap<>();
        List<HrProductionAttendanceShift> duplicates = new ArrayList<>();
        for (HrProductionAttendanceShift shift : allShifts) {
            String key = shift.getEmployeeCode() + "|" + shift.getWorkDate();
            HrProductionAttendanceShift existing = unique.putIfAbsent(key, shift);
            if (existing != null) duplicates.add(shift);
        }

        Set<String> exemptedCodes = allShifts.stream()
                .filter(value -> value.getStatus() == HrProductionAttendanceShiftStatus.EXCLUDED)
                .map(HrProductionAttendanceShift::getEmployeeCode).collect(Collectors.toCollection(TreeSet::new));
        Map<String, List<HrProductionAttendanceShift>> byEmployee = unique.values().stream()
                .filter(value -> value.getStatus() != HrProductionAttendanceShiftStatus.EXCLUDED)
                .collect(Collectors.groupingBy(HrProductionAttendanceShift::getEmployeeCode,
                        TreeMap::new, Collectors.toList()));

        List<HrProductionAttendanceDtos.EmployeeSummary> employeeRows = new ArrayList<>();
        for (Map.Entry<String, List<HrProductionAttendanceShift>> entry : byEmployee.entrySet()) {
            List<HrProductionAttendanceShift> shifts = entry.getValue().stream()
                    .sorted(Comparator.comparing(HrProductionAttendanceShift::getWorkDate)).toList();
            HrProductionAttendanceShift first = shifts.getFirst();
            HrEmployee employee = employees.get(entry.getKey());
            Map<Integer, HrProductionAttendanceDtos.DailyWorkValue> days = new TreeMap<>();
            BigDecimal total = BigDecimal.ZERO;
            BigDecimal allowance = BigDecimal.ZERO;
            int dayShifts = 0;
            int nightShifts = 0;
            for (HrProductionAttendanceShift shift : shifts) {
                BigDecimal workValue = officialWorkValue(shift);
                days.put(shift.getWorkDate().getDayOfMonth(), new HrProductionAttendanceDtos.DailyWorkValue(
                        shift.getWorkDate().getDayOfMonth(), workValue, shift.getShiftCodeSnapshot(), shift.getStatus()));
                total = total.add(workValue);
                if (workValue.signum() > 0) {
                    if (isNightShift(shift)) nightShifts++; else dayShifts++;
                }
                if (shift.getStatus() == HrProductionAttendanceShiftStatus.CONFIRMED) {
                    allowance = allowance.add(orZero(shift.getNightAllowanceAmount()));
                }
            }
            employeeRows.add(new HrProductionAttendanceDtos.EmployeeSummary(entry.getKey(),
                    employee == null ? first.getEmployeeName() : employee.getFullName(), departmentName(employee),
                    dominantPolicy(shifts), Collections.unmodifiableMap(days), total, dayShifts, nightShifts, allowance));
        }

        BigDecimal totalWork = employeeRows.stream().map(HrProductionAttendanceDtos.EmployeeSummary::totalWorkValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAllowance = employeeRows.stream().map(HrProductionAttendanceDtos.EmployeeSummary::nightAllowanceAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int dayShifts = employeeRows.stream().mapToInt(HrProductionAttendanceDtos.EmployeeSummary::dayShifts).sum();
        int nightShifts = employeeRows.stream().mapToInt(HrProductionAttendanceDtos.EmployeeSummary::nightShifts).sum();
        int reviewShifts = confirmedImports.stream().mapToInt(HrProductionAttendanceImport::getReviewShifts).sum();
        int incidentShifts = (int) unique.values().stream()
                .filter(value -> value.getStatus() == HrProductionAttendanceShiftStatus.CONFIRMED)
                .filter(value -> value.getResolutionType() == HrAttendanceResolutionType.DEVICE_OUTAGE).count();
        boolean locked = !confirmedImports.isEmpty() && previewImports.isEmpty();

        HrProductionAttendanceDtos.MonthlySummary summary = new HrProductionAttendanceDtos.MonthlySummary(
                month, locked, confirmedImports.size(), previewImports.size(), employeeRows.size(), totalWork,
                dayShifts, nightShifts, totalAllowance, reviewShifts, incidentShifts, exemptedCodes.size(),
                duplicates.size(), List.copyOf(employeeRows));
        return new ReportData(summary, confirmedImports, allShifts, duplicates);
    }

    private void writeSummarySheet(XSSFWorkbook workbook, Styles styles, ReportData report) {
        Sheet sheet = workbook.createSheet("Bảng công");
        int lastColumn = 39;
        Row title = sheet.createRow(0);
        Cell titleCell = title.createCell(0);
        titleCell.setCellValue("BẢNG CÔNG CA SẢN XUẤT - " + displayMonth(report.summary().attendanceMonth()));
        titleCell.setCellStyle(styles.title());
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, lastColumn));

        Row header = sheet.createRow(2);
        String[] fixed = {"STT", "Mã nhân viên", "Họ và tên", "Phòng ban", "Nhóm"};
        int column = 0;
        for (String value : fixed) cell(header, column++, value, styles.header());
        for (int day = 1; day <= 31; day++) cell(header, column++, "Ngày " + day, styles.header());
        for (String value : List.of("Tổng công", "Ca ngày", "Ca đêm", "Phụ cấp đêm")) {
            cell(header, column++, value, styles.header());
        }

        int rowIndex = 3;
        int order = 1;
        for (HrProductionAttendanceDtos.EmployeeSummary employee : report.summary().employees()) {
            Row row = sheet.createRow(rowIndex++);
            number(row, 0, order++, styles.center());
            cell(row, 1, employee.employeeCode(), styles.text());
            cell(row, 2, employee.employeeName(), styles.text());
            cell(row, 3, employee.departmentName(), styles.text());
            cell(row, 4, policyLabel(employee.policyGroup()), styles.center());
            for (int day = 1; day <= 31; day++) {
                HrProductionAttendanceDtos.DailyWorkValue value = employee.days().get(day);
                if (value != null) decimal(row, day + 4, value.workValue(), styles.work());
                else cell(row, day + 4, "", styles.work());
            }
            decimal(row, 36, employee.totalWorkValue(), styles.total());
            number(row, 37, employee.dayShifts(), styles.center());
            number(row, 38, employee.nightShifts(), styles.center());
            decimal(row, 39, employee.nightAllowanceAmount(), styles.money());
        }
        sheet.createFreezePane(5, 3);
        sheet.setAutoFilter(new CellRangeAddress(2, Math.max(2, rowIndex - 1), 0, lastColumn));
        sheet.setColumnWidth(0, 1800);
        sheet.setColumnWidth(1, 3600);
        sheet.setColumnWidth(2, 7200);
        sheet.setColumnWidth(3, 6500);
        sheet.setColumnWidth(4, 4800);
        for (int i = 5; i <= 35; i++) sheet.setColumnWidth(i, 2300);
        for (int i = 36; i <= lastColumn; i++) sheet.setColumnWidth(i, 3500);
    }

    private void writeReconciliationSheet(XSSFWorkbook workbook, Styles styles, ReportData report) {
        Sheet sheet = workbook.createSheet("Đối soát");
        Row header = sheet.createRow(0);
        String[] columns = {"Loại", "Mã nhân viên", "Ngày", "Ca/nguồn", "Trạng thái", "Chi tiết"};
        for (int i = 0; i < columns.length; i++) cell(header, i, columns[i], styles.header());
        int rowIndex = 1;

        for (HrProductionAttendanceShift shift : report.allShifts()) {
            if (shift.getStatus() == HrProductionAttendanceShiftStatus.CONFIRMED
                    && shift.getResolutionType() != HrAttendanceResolutionType.DEVICE_OUTAGE
                    && shift.getResolutionType() != HrAttendanceResolutionType.MANUAL_OVERRIDE) continue;
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, "CA", styles.text());
            cell(row, 1, shift.getEmployeeCode(), styles.text());
            cell(row, 2, shift.getWorkDate().format(DATE), styles.center());
            cell(row, 3, Objects.toString(shift.getShiftCodeSnapshot(), "—"), styles.text());
            cell(row, 4, shift.getStatus().name(), styles.center());
            cell(row, 5, Objects.toString(shift.getExplanation(), ""), styles.text());
        }
        for (HrProductionAttendanceShift shift : report.duplicates()) {
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, "TRÙNG NGÀY", styles.text());
            cell(row, 1, shift.getEmployeeCode(), styles.text());
            cell(row, 2, shift.getWorkDate().format(DATE), styles.center());
            cell(row, 3, shift.getImportId(), styles.text());
            cell(row, 4, shift.getStatus().name(), styles.center());
            cell(row, 5, "Không cộng lặp vào tổng công; cần kiểm tra file nguồn.", styles.text());
        }

        List<String> importIds = report.confirmedImports().stream().map(HrProductionAttendanceImport::getId).toList();
        Set<String> usedPunchIds = report.allShifts().stream()
                .flatMap(value -> java.util.stream.Stream.of(value.getCheckInPunchId(), value.getCheckOutPunchId()))
                .filter(Objects::nonNull).collect(Collectors.toSet());
        for (HrAttendancePunch punch : importIds.isEmpty() ? List.<HrAttendancePunch>of()
                : punchRepository.findByImportIdInOrderByEmployeeCodeAscPunchedAtAsc(importIds)) {
            if (usedPunchIds.contains(punch.getId())) continue;
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, "DẤU CHƯA DÙNG", styles.text());
            cell(row, 1, punch.getEmployeeCode(), styles.text());
            cell(row, 2, punch.getWorkDate().format(DATE), styles.center());
            cell(row, 3, punch.getSourceColumn(), styles.center());
            cell(row, 4, "CHƯA GHÉP", styles.center());
            cell(row, 5, punch.getPunchedAt().format(DATE_TIME) + " · giá trị gốc: " + punch.getRawValue(), styles.text());
        }

        List<String> shiftIds = report.allShifts().stream().map(HrProductionAttendanceShift::getId).toList();
        for (HrAttendanceShiftAdjustment adjustment : shiftIds.isEmpty() ? List.<HrAttendanceShiftAdjustment>of()
                : adjustmentRepository.findByShiftIdInOrderByCreatedAtDesc(shiftIds)) {
            Row row = sheet.createRow(rowIndex++);
            cell(row, 0, "ĐIỀU CHỈNH", styles.text());
            cell(row, 1, "", styles.text());
            cell(row, 2, adjustment.getCreatedAt() == null ? "" : adjustment.getCreatedAt().format(DATE_TIME), styles.center());
            cell(row, 3, adjustment.getShiftId(), styles.text());
            cell(row, 4, adjustment.getCreatedByActor(), styles.text());
            cell(row, 5, adjustment.getReason(), styles.text());
        }
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, rowIndex - 1), 0, 5));
        int[] widths = {4200, 4200, 3600, 5800, 4400, 15000};
        for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);
    }

    private Map<String, HrEmployee> employees(List<HrProductionAttendanceShift> shifts) {
        List<String> codes = shifts.stream().map(HrProductionAttendanceShift::getEmployeeCode).distinct().toList();
        if (codes.isEmpty()) return Map.of();
        return employeeRepository.findAttendanceEmployeesByCodes(codes).stream()
                .collect(Collectors.toMap(HrEmployee::getEmployeeCode, Function.identity()));
    }

    private static BigDecimal officialWorkValue(HrProductionAttendanceShift shift) {
        return shift.getStatus() == HrProductionAttendanceShiftStatus.CONFIRMED ? orZero(shift.getWorkValue()) : BigDecimal.ZERO;
    }

    private static boolean isNightShift(HrProductionAttendanceShift shift) {
        return orZero(shift.getNightAllowanceAmount()).signum() > 0 || "CN_18_5".equals(shift.getShiftCodeSnapshot());
    }

    private static BigDecimal orZero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }

    private static HrAttendancePolicyGroup dominantPolicy(List<HrProductionAttendanceShift> shifts) {
        return shifts.stream().collect(Collectors.groupingBy(HrProductionAttendanceShift::getPolicyGroup, Collectors.counting()))
                .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey)
                .orElse(HrAttendancePolicyGroup.PRODUCTION_WORKER);
    }

    private static String departmentName(HrEmployee employee) {
        return employee == null || employee.getEmployment() == null || employee.getEmployment().getDepartment() == null
                ? "" : employee.getEmployment().getDepartment().getName();
    }

    private static YearMonth parseMonth(String value) {
        try { return YearMonth.parse(Objects.requireNonNull(value, "month").trim()); }
        catch (RuntimeException ex) {
            throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_MONTH_INVALID", "Tháng phải có dạng yyyy-MM.");
        }
    }

    private static String displayMonth(String month) {
        YearMonth value = YearMonth.parse(month);
        return String.format("%02d/%d", value.getMonthValue(), value.getYear());
    }

    private static String policyLabel(HrAttendancePolicyGroup group) {
        return switch (group) {
            case PRODUCTION_WORKER -> "Công nhân";
            case KCS -> "KCS";
            case OFFICE -> "Hành chính";
        };
    }

    private static void cell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private static void number(Row row, int column, int value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private static void decimal(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(orZero(value).doubleValue());
        cell.setCellStyle(style);
    }

    public record ExportFile(String fileName, byte[] content) { }

    private record ReportData(HrProductionAttendanceDtos.MonthlySummary summary,
                              List<HrProductionAttendanceImport> confirmedImports,
                              List<HrProductionAttendanceShift> allShifts,
                              List<HrProductionAttendanceShift> duplicates) { }

    private record Styles(CellStyle title, CellStyle header, CellStyle text, CellStyle center,
                          CellStyle work, CellStyle total, CellStyle money) {
        private Styles(Workbook workbook) {
            this(title(workbook), header(workbook), base(workbook, HorizontalAlignment.LEFT, "@"),
                    base(workbook, HorizontalAlignment.CENTER, "@"),
                    base(workbook, HorizontalAlignment.CENTER, "0.##"),
                    emphasized(workbook, "0.##"), emphasized(workbook, "#,##0"));
        }

        private static CellStyle title(Workbook workbook) {
            CellStyle style = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true); font.setFontHeightInPoints((short) 16);
            style.setFont(font); style.setAlignment(HorizontalAlignment.CENTER);
            return style;
        }

        private static CellStyle header(Workbook workbook) {
            CellStyle style = base(workbook, HorizontalAlignment.CENTER, "@");
            Font font = workbook.createFont(); font.setBold(true); font.setColor(IndexedColors.WHITE.getIndex());
            style.setFont(font); style.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND); style.setWrapText(true);
            return style;
        }

        private static CellStyle emphasized(Workbook workbook, String format) {
            CellStyle style = base(workbook, HorizontalAlignment.RIGHT, format);
            Font font = workbook.createFont(); font.setBold(true); style.setFont(font);
            style.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex());
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            return style;
        }

        private static CellStyle base(Workbook workbook, HorizontalAlignment alignment, String format) {
            CellStyle style = workbook.createCellStyle();
            style.setAlignment(alignment); style.setVerticalAlignment(VerticalAlignment.CENTER);
            style.setBorderTop(BorderStyle.THIN); style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN); style.setBorderRight(BorderStyle.THIN);
            style.setDataFormat(workbook.createDataFormat().getFormat(format));
            return style;
        }
    }
}

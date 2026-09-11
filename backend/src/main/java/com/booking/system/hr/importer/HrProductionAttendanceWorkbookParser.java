package com.booking.system.hr.importer;

import com.booking.system.hr.api.HrApiException;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Component
public class HrProductionAttendanceWorkbookParser {
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"),
            DateTimeFormatter.ofPattern("d-MMM-uu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-MMM-uuuu", Locale.ENGLISH)
    );
    private static final List<DateTimeFormatter> TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("H:mm"),
            DateTimeFormatter.ofPattern("H:mm:ss"),
            DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h:mm:ss a", Locale.ENGLISH)
    );

    public ParsedWorkbook parse(byte[] content, String requestedMonth) {
        if (content == null || content.length == 0) {
            throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_FILE_EMPTY", "File chấm công đang trống.");
        }
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            if (workbook.getNumberOfSheets() == 0) {
                throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_SHEET_MISSING", "File không có sheet dữ liệu.");
            }
            Sheet sheet = workbook.getSheetAt(0);
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            DataFormatter formatter = new DataFormatter(Locale.US);
            Header header = locateHeader(sheet, formatter, evaluator);
            List<ParsedDay> days = new ArrayList<>();
            Set<YearMonth> months = new LinkedHashSet<>();
            int totalPunches = 0;

            for (int rowIndex = header.rowIndex() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) continue;
                String code = clean(format(row.getCell(header.codeColumn()), formatter, evaluator)).toUpperCase(Locale.ROOT);
                String name = clean(format(row.getCell(header.nameColumn()), formatter, evaluator));
                String rawDate = clean(format(row.getCell(header.dateColumn()), formatter, evaluator));
                if (code.isBlank() && name.isBlank() && rawDate.isBlank()) continue;
                if (code.isBlank() || name.isBlank()) {
                    throw rowError(rowIndex, "Thiếu mã hoặc tên nhân viên.");
                }
                LocalDate date = parseDate(row.getCell(header.dateColumn()), rawDate, evaluator, rowIndex);
                months.add(YearMonth.from(date));
                List<ParsedPunch> punches = new ArrayList<>();
                for (int column : header.punchColumns()) {
                    Cell cell = row.getCell(column);
                    String raw = clean(format(cell, formatter, evaluator));
                    if (raw.isBlank()) continue;
                    LocalTime time = parseTime(cell, raw, evaluator, rowIndex, column);
                    punches.add(new ParsedPunch(columnName(column), raw, LocalDateTime.of(date, time)));
                }
                totalPunches += punches.size();
                days.add(new ParsedDay(rowIndex + 1, code, name, date, List.copyOf(punches)));
            }
            if (days.isEmpty()) {
                throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_NO_ROWS", "Không tìm thấy dòng chấm công hợp lệ.");
            }
            if (months.size() != 1) {
                throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_MULTIPLE_MONTHS", "Một file chỉ được chứa các dòng ngày thuộc cùng một tháng.");
            }
            YearMonth attendanceMonth = months.iterator().next();
            if (requestedMonth != null && !requestedMonth.isBlank()) {
                YearMonth requested = parseMonth(requestedMonth);
                if (!requested.equals(attendanceMonth)) {
                    throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_MONTH_MISMATCH",
                            "Tháng đã chọn không khớp ngày trong file: " + attendanceMonth + ".");
                }
            }
            return new ParsedWorkbook(sheet.getSheetName(), attendanceMonth, List.copyOf(days), days.size(), totalPunches);
        } catch (HrApiException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_FILE_INVALID", "Không đọc được file chấm công: " + ex.getMessage());
        }
    }

    private Header locateHeader(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator) {
        for (int rowIndex = 0; rowIndex <= Math.min(sheet.getLastRowNum(), 20); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) continue;
            int code = -1, name = -1, date = -1;
            List<Integer> punches = new ArrayList<>();
            for (Cell cell : row) {
                String value = normalizeHeader(format(cell, formatter, evaluator));
                if (value.equals("ma nhan vien") || value.equals("ma nv")) code = cell.getColumnIndex();
                else if (value.equals("ten nhan vien") || value.equals("ho ten")) name = cell.getColumnIndex();
                else if (value.equals("ngay")) date = cell.getColumnIndex();
                else if (value.startsWith("cham lan") || value.startsWith("lan cham")) punches.add(cell.getColumnIndex());
            }
            if (code >= 0 && name >= 0 && date >= 0) {
                if (punches.isEmpty()) punches = List.of(6, 7, 8, 9);
                return new Header(rowIndex, code, name, date, punches.stream().limit(4).toList());
            }
        }
        return new Header(1, 1, 2, 4, List.of(6, 7, 8, 9));
    }

    private LocalDate parseDate(Cell cell, String raw, FormulaEvaluator evaluator, int rowIndex) {
        CellType type = effectiveType(cell, evaluator);
        if (cell != null && type == CellType.NUMERIC && DateUtil.isValidExcelDate(cell.getNumericCellValue())) {
            return DateUtil.getLocalDateTime(cell.getNumericCellValue()).toLocalDate();
        }
        for (DateTimeFormatter dateFormat : DATE_FORMATS) {
            try { return LocalDate.parse(raw, dateFormat); } catch (DateTimeParseException ignored) { }
        }
        throw rowError(rowIndex, "Ngày không hợp lệ: " + raw);
    }

    private LocalTime parseTime(Cell cell, String raw, FormulaEvaluator evaluator, int rowIndex, int column) {
        CellType type = effectiveType(cell, evaluator);
        if (cell != null && type == CellType.NUMERIC && DateUtil.isValidExcelDate(cell.getNumericCellValue())) {
            return DateUtil.getLocalDateTime(cell.getNumericCellValue()).toLocalTime().withNano(0);
        }
        for (DateTimeFormatter timeFormat : TIME_FORMATS) {
            try { return LocalTime.parse(raw.toUpperCase(Locale.ENGLISH), timeFormat).withNano(0); }
            catch (DateTimeParseException ignored) { }
        }
        throw rowError(rowIndex, "Giờ không hợp lệ tại cột " + columnName(column) + ": " + raw);
    }

    private static CellType effectiveType(Cell cell, FormulaEvaluator evaluator) {
        if (cell == null) return CellType.BLANK;
        return cell.getCellType() == CellType.FORMULA ? evaluator.evaluateFormulaCell(cell) : cell.getCellType();
    }

    private static String format(Cell cell, DataFormatter formatter, FormulaEvaluator evaluator) {
        return cell == null ? "" : formatter.formatCellValue(cell, evaluator);
    }

    private static YearMonth parseMonth(String value) {
        try { return YearMonth.parse(value.trim()); }
        catch (DateTimeException ex) {
            throw HrApiException.badRequest("PRODUCTION_ATTENDANCE_MONTH_INVALID", "Tháng phải có dạng yyyy-MM.");
        }
    }

    private static HrApiException rowError(int zeroBasedRow, String message) {
        return HrApiException.badRequest("PRODUCTION_ATTENDANCE_ROW_INVALID", "Dòng " + (zeroBasedRow + 1) + ": " + message);
    }

    private static String clean(String value) {
        return value == null ? "" : value.replace("_x0000_", "").replace('\u0000', ' ')
                .replaceAll("\\s+", " ").trim();
    }

    private static String normalizeHeader(String value) {
        String normalized = java.text.Normalizer.normalize(clean(value), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
        return normalized.replace('đ', 'd').replaceAll("\\s+", " ").trim();
    }

    private static String columnName(int column) {
        int value = column + 1;
        StringBuilder result = new StringBuilder();
        while (value > 0) {
            int remainder = (value - 1) % 26;
            result.insert(0, (char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return result.toString();
    }

    private record Header(int rowIndex, int codeColumn, int nameColumn, int dateColumn, List<Integer> punchColumns) { }

    public record ParsedWorkbook(String sheetName, YearMonth attendanceMonth, List<ParsedDay> days,
                                 int totalRows, int totalPunches) { }
    public record ParsedDay(int sourceRowNumber, String employeeCode, String employeeName,
                            LocalDate workDate, List<ParsedPunch> punches) { }
    public record ParsedPunch(String sourceColumn, String rawValue, LocalDateTime punchedAt) { }
}

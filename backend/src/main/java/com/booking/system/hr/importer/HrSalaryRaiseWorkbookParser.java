package com.booking.system.hr.importer;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrSalaryRaiseDtos;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

@Component
public class HrSalaryRaiseWorkbookParser {
    public static final int MAX_FILE_BYTES = 10 * 1024 * 1024;

    private static final List<String> REQUIRED = List.of(
            "employeeCode", "fullName", "currentBaseSalary", "currentAllowance", "currentTotal",
            "currentGrade", "newGrade", "newBaseSalary", "newAllowance", "newTotal",
            "reviewCycleMonths", "effectiveDate", "nextReviewDate"
    );
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"),
            DateTimeFormatter.ISO_LOCAL_DATE
    );
    private static final Pattern YEAR = Pattern.compile("\\d{4}");

    public ParsedWorkbook parse(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw HrApiException.badRequest("SALARY_RAISE_FILE_EMPTY", "File nâng lương rỗng.");
        }
        if (bytes.length > MAX_FILE_BYTES) {
            throw HrApiException.badRequest("SALARY_RAISE_FILE_TOO_LARGE", "File nâng lương không được vượt quá 10 MB.");
        }
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("vi-VN"));
            for (Sheet sheet : workbook) {
                Header header = findHeader(sheet, evaluator, formatter);
                if (header == null) continue;
                List<ParsedRow> rows = new ArrayList<>();
                for (int rowIndex = header.rowIndex() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                    Row row = sheet.getRow(rowIndex);
                    if (row == null || text(row.getCell(header.columns().get("employeeCode")), evaluator, formatter) == null) {
                        continue;
                    }
                    rows.add(parseRow(row, header.columns(), evaluator, formatter));
                }
                if (rows.isEmpty()) {
                    throw HrApiException.badRequest("SALARY_RAISE_NO_ROWS", "Không tìm thấy dòng nâng lương trong file.");
                }
                LocalDate firstEffectiveDate = rows.stream().map(value -> value.data().effectiveDate())
                        .filter(Objects::nonNull).findFirst().orElse(null);
                return new ParsedWorkbook(sha256(bytes), bytes.length, sheet.getSheetName(), firstEffectiveDate, rows);
            }
            throw HrApiException.badRequest("SALARY_RAISE_HEADER_INVALID",
                    "Không tìm thấy sheet có đủ các cột nâng lương bắt buộc trong 30 dòng đầu.");
        } catch (HrApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw HrApiException.badRequest("SALARY_RAISE_XLSX_INVALID", "Không thể đọc file Excel nâng lương.");
        }
    }

    private ParsedRow parseRow(Row row, Map<String, Integer> columns,
                               FormulaEvaluator evaluator, DataFormatter formatter) {
        int sourceRow = row.getRowNum() + 1;
        List<HrImportIssue> issues = new ArrayList<>();
        String employeeCode = requiredText(row, columns, "employeeCode", evaluator, formatter, issues);
        if (employeeCode != null) employeeCode = employeeCode.toUpperCase(Locale.ROOT);
        String fullName = requiredText(row, columns, "fullName", evaluator, formatter, issues);
        BigDecimal currentBase = money(row, columns, "currentBaseSalary", evaluator, formatter, issues);
        BigDecimal currentAllowance = moneyOrZero(row, columns, "currentAllowance", evaluator, formatter, issues);
        BigDecimal currentTotal = moneyOrSum(row, columns, "currentTotal", currentBase, currentAllowance,
                evaluator, formatter, issues);
        String currentGrade = requiredText(row, columns, "currentGrade", evaluator, formatter, issues);
        String scaleCode = optionalText(row, columns, "salaryScaleCode", evaluator, formatter);
        String newGrade = requiredText(row, columns, "newGrade", evaluator, formatter, issues);
        BigDecimal newBase = money(row, columns, "newBaseSalary", evaluator, formatter, issues);
        BigDecimal newAllowance = moneyOrZero(row, columns, "newAllowance", evaluator, formatter, issues);
        BigDecimal newTotal = moneyOrSum(row, columns, "newTotal", newBase, newAllowance,
                evaluator, formatter, issues);
        Integer cycle = reviewCycle(row, columns, "reviewCycleMonths", evaluator, formatter, issues);
        LocalDate effectiveDate = date(row, columns, "effectiveDate", evaluator, formatter, issues);
        LocalDate nextReviewDate = optionalDate(row, columns, "nextReviewDate", evaluator, formatter, issues);

        if ((cycle == null) != (nextReviewDate == null)) {
            issues.add(issue(HrImportIssueCode.NEXT_REVIEW_DATE_MISMATCH, HrImportIssueSeverity.ERROR,
                    cell(columns, "nextReviewDate", sourceRow), "nextReviewDate",
                    "Hạn nâng bậc và ngày tới hạn phải cùng có giá trị, hoặc cùng để trống/Hết."));
        }

        verifyTotal(currentBase, currentAllowance, currentTotal, sourceRow,
                cell(columns, "currentTotal", sourceRow), "currentTotal", issues);
        verifyTotal(newBase, newAllowance, newTotal, sourceRow,
                cell(columns, "newTotal", sourceRow), "newTotal", issues);
        if (currentTotal != null && newTotal != null && newTotal.compareTo(currentTotal) <= 0) {
            issues.add(issue(HrImportIssueCode.SALARY_TOTAL_NOT_INCREASED, HrImportIssueSeverity.ERROR,
                    cell(columns, "newTotal", sourceRow), "newTotal",
                    "Tổng lương sau nâng phải lớn hơn tổng lương hiện tại."));
        }
        if (cycle != null && effectiveDate != null && nextReviewDate != null
                && !effectiveDate.plusMonths(cycle).equals(nextReviewDate)) {
            issues.add(issue(HrImportIssueCode.NEXT_REVIEW_DATE_MISMATCH, HrImportIssueSeverity.WARNING,
                    cell(columns, "nextReviewDate", sourceRow), "nextReviewDate",
                    "Ngày tới hạn khác phép cộng tháng lịch; hệ thống vẫn giữ đúng ngày trong file."));
        }

        HrSalaryRaiseDtos.RowData data = new HrSalaryRaiseDtos.RowData(sourceRow, employeeCode, fullName,
                currentBase, currentAllowance, currentTotal, currentGrade, scaleCode, newGrade, newBase,
                newAllowance, newTotal, cycle, effectiveDate, nextReviewDate, null, null, null, null);
        return new ParsedRow(sourceRow, data, issues);
    }

    private Header findHeader(Sheet sheet, FormulaEvaluator evaluator, DataFormatter formatter) {
        int last = Math.min(sheet.getLastRowNum(), 29);
        for (int rowIndex = 0; rowIndex <= last; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) continue;
            Map<String, Integer> columns = new HashMap<>();
            for (Cell cell : row) {
                String key = headerKey(text(cell, evaluator, formatter));
                if (key != null) columns.putIfAbsent(key, cell.getColumnIndex());
            }
            if (columns.keySet().containsAll(REQUIRED)) return new Header(rowIndex, columns);
        }
        return null;
    }

    private String headerKey(String value) {
        String header = normalize(value);
        if (header == null) return null;
        if (header.equals("ms") || header.equals("ma nhan vien")) return "employeeCode";
        if (header.equals("ho va ten")) return "fullName";
        if (header.equals("bac sau khi nang")) return "newGrade";
        if (header.equals("luong sau nang bac")) return "newBaseSalary";
        if (header.equals("phu cap sau nang")) return "newAllowance";
        if (header.equals("tong luong sau nang")) return "newTotal";
        if (header.equals("han nang bac")) return "reviewCycleMonths";
        if (header.equals("ngay nang bac gan nhat")) return "effectiveDate";
        if (header.equals("ngay toi han")) return "nextReviewDate";
        if (header.equals("ma ngach luong")) return "salaryScaleCode";
        String[] parts = header.split(" ");
        if (parts.length >= 2 && YEAR.matcher(parts[parts.length - 1]).matches()) {
            String base = String.join(" ", Arrays.copyOf(parts, parts.length - 1));
            return switch (base) {
                case "luong" -> "currentBaseSalary";
                case "phu cap" -> "currentAllowance";
                case "tong luong" -> "currentTotal";
                case "bac" -> "currentGrade";
                case "ma so" -> "salaryScaleCode";
                default -> null;
            };
        }
        return null;
    }

    private String requiredText(Row row, Map<String, Integer> columns, String field,
                                FormulaEvaluator evaluator, DataFormatter formatter,
                                List<HrImportIssue> issues) {
        String value = optionalText(row, columns, field, evaluator, formatter);
        if (value == null) {
            issues.add(issue(HrImportIssueCode.MISSING_REQUIRED_VALUE, HrImportIssueSeverity.ERROR,
                    cell(columns, field, row.getRowNum() + 1), field, "Thiếu giá trị bắt buộc."));
        }
        return value;
    }

    private String optionalText(Row row, Map<String, Integer> columns, String field,
                                FormulaEvaluator evaluator, DataFormatter formatter) {
        Integer column = columns.get(field);
        return column == null ? null : text(row.getCell(column), evaluator, formatter);
    }

    private BigDecimal money(Row row, Map<String, Integer> columns, String field,
                             FormulaEvaluator evaluator, DataFormatter formatter,
                             List<HrImportIssue> issues) {
        Integer column = columns.get(field);
        Cell value = column == null ? null : row.getCell(column);
        if (value == null || value.getCellType() == CellType.BLANK) {
            issues.add(issue(HrImportIssueCode.MISSING_REQUIRED_VALUE, HrImportIssueSeverity.ERROR,
                    cell(columns, field, row.getRowNum() + 1), field, "Thiếu số tiền bắt buộc."));
            return null;
        }
        try {
            CellValue evaluated = evaluator.evaluate(value);
            BigDecimal result;
            if (evaluated != null && evaluated.getCellType() == CellType.NUMERIC) {
                result = BigDecimal.valueOf(evaluated.getNumberValue());
            } else {
                String raw = text(value, evaluator, formatter);
                result = new BigDecimal(raw.replaceAll("[^0-9-]", ""));
            }
            if (result.signum() < 0) throw new NumberFormatException();
            return result.setScale(2);
        } catch (RuntimeException exception) {
            issues.add(issue(HrImportIssueCode.INVALID_NUMBER, HrImportIssueSeverity.ERROR,
                    cell(columns, field, row.getRowNum() + 1), field, "Số tiền không hợp lệ."));
            return null;
        }
    }

    private BigDecimal moneyOrZero(Row row, Map<String, Integer> columns, String field,
                                   FormulaEvaluator evaluator, DataFormatter formatter,
                                   List<HrImportIssue> issues) {
        Integer column = columns.get(field);
        Cell value = column == null ? null : row.getCell(column);
        if (value == null || text(value, evaluator, formatter) == null) {
            return BigDecimal.ZERO.setScale(2);
        }
        return money(row, columns, field, evaluator, formatter, issues);
    }

    private BigDecimal moneyOrSum(Row row, Map<String, Integer> columns, String field,
                                  BigDecimal base, BigDecimal allowance,
                                  FormulaEvaluator evaluator, DataFormatter formatter,
                                  List<HrImportIssue> issues) {
        Integer column = columns.get(field);
        Cell value = column == null ? null : row.getCell(column);
        if (value == null || text(value, evaluator, formatter) == null) {
            return base == null || allowance == null ? null : base.add(allowance).setScale(2);
        }
        return money(row, columns, field, evaluator, formatter, issues);
    }

    private Integer positiveInteger(Row row, Map<String, Integer> columns, String field,
                                    FormulaEvaluator evaluator, DataFormatter formatter,
                                    List<HrImportIssue> issues) {
        String raw = optionalText(row, columns, field, evaluator, formatter);
        try {
            if (raw == null) throw new NumberFormatException();
            int value = new BigDecimal(raw.replaceAll("[^0-9-]", "")).intValueExact();
            if (value <= 0) throw new NumberFormatException();
            return value;
        } catch (RuntimeException exception) {
            issues.add(issue(HrImportIssueCode.INVALID_NUMBER, HrImportIssueSeverity.ERROR,
                    cell(columns, field, row.getRowNum() + 1), field, "Hạn nâng bậc phải là số tháng nguyên dương."));
            return null;
        }
    }

    private Integer reviewCycle(Row row, Map<String, Integer> columns, String field,
                                FormulaEvaluator evaluator, DataFormatter formatter,
                                List<HrImportIssue> issues) {
        String raw = optionalText(row, columns, field, evaluator, formatter);
        if (raw == null || "het".equals(normalize(raw))) return null;
        return positiveInteger(row, columns, field, evaluator, formatter, issues);
    }

    private LocalDate date(Row row, Map<String, Integer> columns, String field,
                           FormulaEvaluator evaluator, DataFormatter formatter,
                           List<HrImportIssue> issues) {
        Integer column = columns.get(field);
        Cell value = column == null ? null : row.getCell(column);
        if (value != null) {
            try {
                CellValue evaluated = evaluator.evaluate(value);
                if (evaluated != null && evaluated.getCellType() == CellType.NUMERIC
                        && DateUtil.isValidExcelDate(evaluated.getNumberValue())) {
                    return DateUtil.getLocalDateTime(evaluated.getNumberValue()).toLocalDate();
                }
                String raw = text(value, evaluator, formatter);
                if (raw != null) {
                    for (DateTimeFormatter format : DATE_FORMATS) {
                        try {
                            return LocalDate.parse(raw, format);
                        } catch (DateTimeParseException ignored) {
                            // Try the next accepted source format.
                        }
                    }
                }
            } catch (RuntimeException ignored) {
                // Converted to a row issue below.
            }
        }
        issues.add(issue(HrImportIssueCode.INVALID_DATE, HrImportIssueSeverity.ERROR,
                cell(columns, field, row.getRowNum() + 1), field, "Ngày bắt buộc không hợp lệ."));
        return null;
    }

    private LocalDate optionalDate(Row row, Map<String, Integer> columns, String field,
                                   FormulaEvaluator evaluator, DataFormatter formatter,
                                   List<HrImportIssue> issues) {
        Integer column = columns.get(field);
        Cell value = column == null ? null : row.getCell(column);
        if (value == null || text(value, evaluator, formatter) == null) return null;
        return date(row, columns, field, evaluator, formatter, issues);
    }

    private void verifyTotal(BigDecimal base, BigDecimal allowance, BigDecimal total, int row,
                             String cell, String field, List<HrImportIssue> issues) {
        if (base != null && allowance != null && total != null && base.add(allowance).compareTo(total) != 0) {
            issues.add(issue(HrImportIssueCode.DERIVED_TOTAL_MISMATCH, HrImportIssueSeverity.ERROR,
                    cell, field, "Tổng lương không bằng lương cộng phụ cấp."));
        }
    }

    private String text(Cell cell, FormulaEvaluator evaluator, DataFormatter formatter) {
        if (cell == null) return null;
        String value = formatter.formatCellValue(cell, evaluator);
        value = value == null ? null : value.replace('\u00a0', ' ').trim().replaceAll("\\s+", " ");
        return value == null || value.isBlank() ? null : value;
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String result = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
        return result.isBlank() ? null : result;
    }

    private static HrImportIssue issue(HrImportIssueCode code, HrImportIssueSeverity severity,
                                       String cell, String field, String message) {
        return new HrImportIssue(code, severity, cell, field, message);
    }

    private static String cell(Map<String, Integer> columns, String field, int row) {
        Integer column = columns.get(field);
        return column == null ? "" : CellReference.convertNumToColString(column) + row;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tính checksum file nâng lương.", exception);
        }
    }

    private record Header(int rowIndex, Map<String, Integer> columns) {
    }

    public record ParsedWorkbook(String sha256, long fileSize, String sheetName,
                                 LocalDate firstEffectiveDate, List<ParsedRow> rows) {
    }

    public record ParsedRow(int sourceRowNumber, HrSalaryRaiseDtos.RowData data,
                            List<HrImportIssue> issues) {
    }
}

package com.booking.system.hr.importer;

import com.booking.system.hr.enums.HrEmployeeGender;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Strict reader for the locked Phase 0.1 baseline. It reads OOXML directly so
 * the production artifact does not need a general spreadsheet dependency.
 */
@Component
public class HrBaselineWorkbookParser {

    public static final String SOURCE_SHEET = "T6-26";
    public static final LocalDate PERIOD_START = LocalDate.of(2026, 6, 1);
    public static final LocalDate PERIOD_END = LocalDate.of(2026, 6, 30);
    public static final int FIRST_DATA_ROW = 5;
    public static final int LAST_DATA_ROW = 333;
    public static final int EXPECTED_DATA_ROWS = 329;
    public static final int MAX_FILE_BYTES = 10 * 1024 * 1024;

    private static final String MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static final String DOCUMENT_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static final int EXPECTED_COLUMNS = 34;
    private static final int MAX_ZIP_ENTRIES = 256;
    private static final long MAX_UNCOMPRESSED_BYTES = 25L * 1024 * 1024;
    private static final Pattern CELL_REFERENCE = Pattern.compile("^([A-Z]{1,3})([1-9][0-9]*)$");
    private static final List<String> SHEET_NAMES = List.of("GIAM", "TĂNG", SOURCE_SHEET);
    private static final DateTimeFormatter TEXT_DATE_FORMAT = new DateTimeFormatterBuilder()
            .parseCaseSensitive()
            .appendPattern("d/M/uuuu")
            .toFormatter(Locale.ROOT)
            .withResolverStyle(ResolverStyle.STRICT);

    private static final List<String> HEADERS = List.of(
            "STT", "STT(Phòng ban)", "MÃ SỐ", "Số sổ BHXH", "HỌ VÀ TÊN", "BHYT",
            "Lương", "Phụ cấp", "TỔNG THU NHẬP", "GIỚI TÍNH", "DÂN TỘC", "TÔN GIÁO",
            "CHỨC VỤ", "ĐƠN VỊ CÔNG TÁC", "NGÀY SINH", "NGÀY LÀM", "HĐLĐ", "SỐ HĐLĐ",
            "NĂM CÔNG TÁC", "CMND", "CCCD", "NGÀY CẤP", "MÔI TRƯỜNG LÀM VIỆC",
            "NƠI CẤP", "NƠI SINH", "NƠI SINH (Sau sát nhập)", "ĐỊA CHỈ THƯỜNG TRÚ",
            "ĐỊA CHỈ HIỆN NAY", "SỐ ĐIỆN THOẠI", "TRÌNH ĐỘ", "CHUYÊN NGÀNH",
            "CÔNG VIỆC PHẢI LÀM", "TUỔI", "NGÀY NGHỈ PHÉP"
    );

    public HrParsedBaselineWorkbook parse(byte[] workbookBytes) {
        Map<String, byte[]> parts = readSafePackage(workbookBytes);
        try {
            WorkbookContract contract = inspectWorkbook(parts);
            Map<String, OoxmlCell> cells = readCells(parts, contract.sourceSheetPart(), contract.sharedStrings());
            validateSheetContract(parts.get(contract.sourceSheetPart()), cells);

            List<HrParsedBaselineRow> rows = new ArrayList<>(EXPECTED_DATA_ROWS);
            for (int excelRow = FIRST_DATA_ROW; excelRow <= LAST_DATA_ROW; excelRow++) {
                rows.add(parseRow(cells, excelRow));
            }
            return new HrParsedBaselineWorkbook(
                    sha256(workbookBytes),
                    workbookBytes.length,
                    SOURCE_SHEET,
                    PERIOD_START,
                    rows
            );
        } catch (HrBaselineImportException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new HrBaselineImportException(
                    "INVALID_XLSX",
                    "Không thể đọc workbook baseline theo contract Phase 2.",
                    exception
            );
        }
    }

    private WorkbookContract inspectWorkbook(Map<String, byte[]> parts) {
        requirePart(parts, "xl/workbook.xml");
        requirePart(parts, "xl/_rels/workbook.xml.rels");
        rejectExternalRelationships(parts);

        Document workbook = xml(parts.get("xl/workbook.xml"));
        Map<String, String> relationshipTargets = workbookRelationshipTargets(
                parts.get("xl/_rels/workbook.xml.rels")
        );
        NodeList sheetNodes = workbook.getElementsByTagNameNS(MAIN_NS, "sheet");
        if (sheetNodes.getLength() != SHEET_NAMES.size()) {
            throw structural("SHEET_CONTRACT_MISMATCH", "Workbook phải có đúng ba sheet đã khóa.");
        }

        String sourcePart = null;
        for (int index = 0; index < sheetNodes.getLength(); index++) {
            Element sheet = (Element) sheetNodes.item(index);
            String name = sheet.getAttribute("name");
            if (!SHEET_NAMES.get(index).equals(name)
                    || (sheet.hasAttribute("state") && !"visible".equals(sheet.getAttribute("state")))) {
                throw structural("SHEET_CONTRACT_MISMATCH", "Danh sách hoặc trạng thái sheet không đúng contract.");
            }
            String relationshipId = sheet.getAttributeNS(DOCUMENT_REL_NS, "id");
            String target = relationshipTargets.get(relationshipId);
            if (target == null) {
                throw structural("SHEET_RELATIONSHIP_MISSING", "Sheet thiếu relationship nội bộ.");
            }
            String part = resolvePart("xl/workbook.xml", target);
            requirePart(parts, part);
            if (SOURCE_SHEET.equals(name)) sourcePart = part;
        }
        if (sourcePart == null) {
            throw structural("SOURCE_SHEET_MISSING", "Không tìm thấy sheet nguồn T6-26.");
        }

        for (Map.Entry<String, byte[]> entry : parts.entrySet()) {
            if (!entry.getKey().startsWith("xl/worksheets/") || !entry.getKey().endsWith(".xml")) continue;
            if (xml(entry.getValue()).getElementsByTagNameNS(MAIN_NS, "f").getLength() > 0) {
                throw structural("FORMULA_NOT_ALLOWED", "Workbook baseline không được chứa công thức.");
            }
        }

        return new WorkbookContract(sourcePart, readSharedStrings(parts));
    }

    private void validateSheetContract(byte[] sourceSheetXml, Map<String, OoxmlCell> cells) {
        Document sheet = xml(sourceSheetXml);
        NodeList dimensions = sheet.getElementsByTagNameNS(MAIN_NS, "dimension");
        if (dimensions.getLength() != 1
                || !"A1:AH333".equals(((Element) dimensions.item(0)).getAttribute("ref"))) {
            throw structural("RANGE_MISMATCH", "Vùng dữ liệu T6-26 phải là A1:AH333.");
        }
        NodeList filters = sheet.getElementsByTagNameNS(MAIN_NS, "autoFilter");
        if (filters.getLength() != 1
                || !"A4:AH333".equals(((Element) filters.item(0)).getAttribute("ref"))) {
            throw structural("FILTER_MISMATCH", "Vùng filter T6-26 phải là A4:AH333.");
        }

        for (int column = 0; column < EXPECTED_COLUMNS; column++) {
            OoxmlCell cell = cells.get(columnName(column) + "4");
            String actual = normalizeHeader(cell == null ? null : cell.value());
            if (!normalizeHeader(HEADERS.get(column)).equals(actual)) {
                throw structural("HEADER_MISMATCH", "Header không đúng contract tại ô " + columnName(column) + "4.");
            }
        }
        for (Map.Entry<String, OoxmlCell> entry : cells.entrySet()) {
            CellCoordinate coordinate = coordinate(entry.getKey());
            if (coordinate.column() >= EXPECTED_COLUMNS || coordinate.row() > LAST_DATA_ROW) {
                if (!entry.getValue().isBlank()) {
                    throw structural("DATA_OUTSIDE_CONTRACT", "Có dữ liệu ngoài vùng A1:AH333.");
                }
            }
        }
    }

    private HrParsedBaselineRow parseRow(Map<String, OoxmlCell> cells, int excelRow) {
        List<HrImportIssue> issues = new ArrayList<>();
        Map<String, HrRawCell> rawCells = new LinkedHashMap<>();
        for (int column = 0; column < EXPECTED_COLUMNS; column++) {
            String name = columnName(column);
            rawCells.put(name, rawCell(cells.get(name + excelRow)));
        }

        int displayOrder = integer(value(cells, 0, excelRow), excelRow, 0,
                "displayOrder", true, issues, excelRow - 4);
        Integer departmentDisplayOrder = nullableInteger(value(cells, 1, excelRow), excelRow, 1,
                "departmentDisplayOrder", issues);
        String employeeCode = requiredText(value(cells, 2, excelRow), excelRow, 2,
                "employeeCode", 32, false, issues);
        String socialInsuranceNumber = identifier(value(cells, 3, excelRow), excelRow, 3,
                "socialInsuranceNumber", issues);
        String fullName = requiredText(value(cells, 4, excelRow), excelRow, 4,
                "fullName", 255, false, issues);
        String healthInsuranceNumber = identifier(value(cells, 5, excelRow), excelRow, 5,
                "healthInsuranceNumber", issues);
        BigDecimal baseSalary = decimal(value(cells, 6, excelRow), excelRow, 6,
                "baseSalary", false, issues);
        BigDecimal allowance = decimal(value(cells, 7, excelRow), excelRow, 7,
                "allowance", false, issues);
        BigDecimal totalIncome = decimal(value(cells, 8, excelRow), excelRow, 8,
                "sourceTotalIncome", true, issues);
        HrEmployeeGender gender = gender(value(cells, 9, excelRow), excelRow, issues);
        String ethnicity = optionalText(value(cells, 10, excelRow), excelRow, 10,
                "ethnicity", 100, false, issues);
        String religion = optionalText(value(cells, 11, excelRow), excelRow, 11,
                "religion", 100, false, issues);
        String positionName = requiredText(value(cells, 12, excelRow), excelRow, 12,
                "positionName", 255, false, issues);
        String departmentName = requiredText(value(cells, 13, excelRow), excelRow, 13,
                "departmentName", 255, false, issues);
        LocalDate dateOfBirth = date(value(cells, 14, excelRow), excelRow, 14,
                "dateOfBirth", true, issues);
        LocalDate hireDate = date(value(cells, 15, excelRow), excelRow, 15,
                "hireDate", true, issues);
        String contractType = optionalText(value(cells, 16, excelRow), excelRow, 16,
                "contractTypeLabel", 100, false, issues);
        String contractNumber = optionalText(value(cells, 17, excelRow), excelRow, 17,
                "contractNumber", 100, true, issues);
        if (contractNumber == null) {
            warning(issues, excelRow, 17, "contractNumber", HrImportIssueCode.MISSING_REVIEW_FIELD,
                    "Thiếu số hợp đồng; cần kiểm tra hồ sơ nguồn.");
        }
        String sourceYears = optionalText(value(cells, 18, excelRow), excelRow, 18,
                "sourceYearsOfService", 100, true, issues);
        String legacyIdentity = identifier(value(cells, 19, excelRow), excelRow, 19,
                "legacyIdentityNumber", issues);
        String citizenIdentity = identifier(value(cells, 20, excelRow), excelRow, 20,
                "citizenIdentityNumber", issues);
        LocalDate issuedDate = date(value(cells, 21, excelRow), excelRow, 21,
                "identityIssuedDate", false, issues);
        String workingCondition = optionalText(value(cells, 22, excelRow), excelRow, 22,
                "workingConditionName", 255, false, issues);
        if (workingCondition == null) {
            warning(issues, excelRow, 22, "workingConditionName", HrImportIssueCode.MISSING_REVIEW_FIELD,
                    "Thiếu môi trường làm việc; cần xác minh.");
        }
        String issuedPlace = optionalText(value(cells, 23, excelRow), excelRow, 23,
                "identityIssuedPlace", 255, false, issues);
        if (issuedPlace == null) {
            warning(issues, excelRow, 23, "identityIssuedPlace", HrImportIssueCode.MISSING_REVIEW_FIELD,
                    "Thiếu nơi cấp giấy tờ; cần xác minh.");
        }
        String birthPlaceOriginal = optionalText(value(cells, 24, excelRow), excelRow, 24,
                "birthPlaceOriginal", 500, false, issues);
        String birthPlaceCurrent = optionalText(value(cells, 25, excelRow), excelRow, 25,
                "birthPlaceCurrent", 500, false, issues);
        String permanentAddress = optionalText(value(cells, 26, excelRow), excelRow, 26,
                "permanentAddress", 1000, false, issues);
        String currentAddress = optionalText(value(cells, 27, excelRow), excelRow, 27,
                "currentAddress", 1000, false, issues);
        String phone = identifier(value(cells, 28, excelRow), excelRow, 28, "phone", issues);
        String education = optionalText(value(cells, 29, excelRow), excelRow, 29,
                "educationLevel", 255, false, issues);
        String major = optionalText(value(cells, 30, excelRow), excelRow, 30,
                "major", 255, false, issues);
        String jobDescription = optionalText(value(cells, 31, excelRow), excelRow, 31,
                "jobDescription", 2000, false, issues);
        BigDecimal sourceAge = decimal(value(cells, 32, excelRow), excelRow, 32,
                "sourceAge", false, issues);
        BigDecimal leaveDays = decimal(value(cells, 33, excelRow), excelRow, 33,
                "leaveDays", false, issues);

        if (totalIncome != null) {
            BigDecimal expected = zero(baseSalary).add(zero(allowance));
            if (totalIncome.compareTo(expected) != 0) {
                error(issues, excelRow, 8, "sourceTotalIncome", HrImportIssueCode.DERIVED_TOTAL_MISMATCH,
                        "Tổng thu nhập nguồn không khớp lương cộng phụ cấp.");
            }
        }
        if (sourceAge != null && dateOfBirth != null) {
            int expectedAge = Period.between(dateOfBirth, PERIOD_END).getYears();
            if (sourceAge.stripTrailingZeros().scale() > 0 || sourceAge.intValue() != expectedAge) {
                warning(issues, excelRow, 32, "sourceAge", HrImportIssueCode.DERIVED_AGE_MISMATCH,
                        "Tuổi nguồn không khớp giá trị tính tại cuối tháng 6/2026.");
            }
        }
        if (dateOfBirth != null && hireDate != null && hireDate.isBefore(dateOfBirth)) {
            error(issues, excelRow, 15, "hireDate", HrImportIssueCode.DATE_OUT_OF_RANGE,
                    "Ngày làm không được trước ngày sinh.");
        }

        HrBaselineRowData normalized = new HrBaselineRowData(
                excelRow, displayOrder, departmentDisplayOrder, employeeCode, socialInsuranceNumber,
                fullName, healthInsuranceNumber, baseSalary, allowance, totalIncome, gender, ethnicity,
                religion, positionName, departmentName, dateOfBirth, hireDate, contractType,
                contractNumber, sourceYears, legacyIdentity, citizenIdentity, issuedDate,
                workingCondition, issuedPlace, birthPlaceOriginal, birthPlaceCurrent,
                permanentAddress, currentAddress, phone, education, major, jobDescription,
                sourceAge, leaveDays
        );
        return new HrParsedBaselineRow(excelRow, rawCells, normalized, issues);
    }

    private int integer(OoxmlCell cell, int row, int column, String field, boolean required,
                        List<HrImportIssue> issues, int expected) {
        Integer value = nullableInteger(cell, row, column, field, issues);
        if (value == null) {
            if (required) {
                error(issues, row, column, field, HrImportIssueCode.MISSING_REQUIRED_VALUE,
                        "Thiếu số thứ tự bắt buộc.");
            }
            return 0;
        }
        if (value <= 0 || (expected > 0 && value != expected)) {
            error(issues, row, column, field, HrImportIssueCode.SOURCE_ROW_ORDER_INVALID,
                    "Số thứ tự nguồn không đúng contract.");
        }
        return value;
    }

    private Integer nullableInteger(OoxmlCell cell, int row, int column, String field,
                                    List<HrImportIssue> issues) {
        if (isBlank(cell)) return null;
        try {
            BigDecimal value = numericValue(cell);
            if (value.stripTrailingZeros().scale() > 0 || value.signum() <= 0) throw new NumberFormatException();
            return value.intValueExact();
        } catch (RuntimeException exception) {
            error(issues, row, column, field, HrImportIssueCode.INVALID_NUMBER,
                    "Giá trị thứ tự không phải số nguyên dương.");
            return null;
        }
    }

    private String requiredText(OoxmlCell cell, int row, int column, String field, int maxLength,
                                boolean allowNumeric, List<HrImportIssue> issues) {
        String value = optionalText(cell, row, column, field, maxLength, allowNumeric, issues);
        if (value == null) {
            error(issues, row, column, field, HrImportIssueCode.MISSING_REQUIRED_VALUE,
                    "Thiếu trường bắt buộc trong dữ liệu nguồn.");
        }
        return value;
    }

    private String optionalText(OoxmlCell cell, int row, int column, String field, int maxLength,
                                boolean allowNumeric, List<HrImportIssue> issues) {
        if (isBlank(cell)) return null;
        if ("ERROR".equals(cell.type())) {
            warning(issues, row, column, field, HrImportIssueCode.VALUE_NEEDS_REVIEW,
                    "Giá trị lỗi nguồn được để trống và cần xác minh.");
            return null;
        }

        String value;
        if ("STRING".equals(cell.type())) {
            value = normalizeText(cell.value());
        } else if (allowNumeric && "NUMBER".equals(cell.type())) {
            value = canonicalNumberText(cell.value());
            warning(issues, row, column, field, HrImportIssueCode.NUMERIC_IDENTIFIER_COERCED,
                    "Giá trị định danh dạng số được chuyển sang text; cần kiểm tra số 0 đầu.");
        } else {
            warning(issues, row, column, field, HrImportIssueCode.INVALID_OPTIONAL_VALUE,
                    "Kiểu dữ liệu nguồn không phù hợp; hệ thống để trống trường này.");
            return null;
        }
        if (value == null || "#N/A".equalsIgnoreCase(value)) {
            if ("#N/A".equalsIgnoreCase(value)) {
                warning(issues, row, column, field, HrImportIssueCode.VALUE_NEEDS_REVIEW,
                        "Giá trị #N/A nguồn được để trống và cần xác minh.");
            }
            return null;
        }
        if (value.length() > maxLength) {
            warning(issues, row, column, field, HrImportIssueCode.INVALID_OPTIONAL_VALUE,
                    "Giá trị vượt giới hạn của trường; hệ thống để trống để tránh cắt dữ liệu.");
            return null;
        }
        return value;
    }

    private String identifier(OoxmlCell cell, int row, int column, String field,
                              List<HrImportIssue> issues) {
        String value = optionalText(cell, row, column, field, 32, true, issues);
        if (value != null && value.startsWith("'") && value.length() > 1) {
            value = value.substring(1);
            warning(issues, row, column, field, HrImportIssueCode.IDENTIFIER_FORMAT_NEEDS_REVIEW,
                    "Đã loại dấu nháy kỹ thuật đầu chuỗi; cần xác minh định danh.");
        }
        return value;
    }

    private BigDecimal decimal(OoxmlCell cell, int row, int column, String field, boolean required,
                               List<HrImportIssue> issues) {
        if (isBlank(cell)) {
            if (required) {
                error(issues, row, column, field, HrImportIssueCode.MISSING_REQUIRED_VALUE,
                        "Thiếu giá trị số bắt buộc.");
            }
            return null;
        }
        try {
            BigDecimal value = numericValue(cell).stripTrailingZeros();
            if (value.signum() < 0) {
                error(issues, row, column, field, HrImportIssueCode.NEGATIVE_NUMBER,
                        "Giá trị số không được âm.");
                return null;
            }
            return value.scale() < 0 ? value.setScale(0, RoundingMode.UNNECESSARY) : value;
        } catch (RuntimeException exception) {
            issues.add(new HrImportIssue(
                    HrImportIssueCode.INVALID_NUMBER,
                    required ? HrImportIssueSeverity.ERROR : HrImportIssueSeverity.WARNING,
                    columnName(column) + row,
                    field,
                    required ? "Giá trị số bắt buộc không hợp lệ." : "Giá trị số tùy chọn không hợp lệ; hệ thống để trống."
            ));
            return null;
        }
    }

    private LocalDate date(OoxmlCell cell, int row, int column, String field, boolean required,
                           List<HrImportIssue> issues) {
        if (isBlank(cell)) {
            if (required) {
                error(issues, row, column, field, HrImportIssueCode.MISSING_REQUIRED_VALUE,
                        "Thiếu ngày bắt buộc.");
            }
            return null;
        }
        try {
            LocalDate value;
            if ("NUMBER".equals(cell.type())) {
                BigDecimal serial = new BigDecimal(cell.value());
                if (serial.stripTrailingZeros().scale() > 0 || serial.signum() <= 0) {
                    throw new IllegalArgumentException();
                }
                long days = serial.longValueExact();
                value = (days < 60 ? LocalDate.of(1899, 12, 31) : LocalDate.of(1899, 12, 30))
                        .plusDays(days);
            } else if ("STRING".equals(cell.type()) || "DATE".equals(cell.type())) {
                value = LocalDate.parse(normalizeText(cell.value()), TEXT_DATE_FORMAT);
            } else {
                throw new IllegalArgumentException();
            }
            if (value.isBefore(LocalDate.of(1900, 1, 1)) || value.isAfter(PERIOD_END)) {
                throw new DateOutOfRangeException();
            }
            return value;
        } catch (DateOutOfRangeException exception) {
            addDateIssue(issues, row, column, field, required, HrImportIssueCode.DATE_OUT_OF_RANGE);
            return null;
        } catch (RuntimeException exception) {
            addDateIssue(issues, row, column, field, required, HrImportIssueCode.INVALID_DATE);
            return null;
        }
    }

    private void addDateIssue(List<HrImportIssue> issues, int row, int column, String field,
                              boolean required, HrImportIssueCode code) {
        issues.add(new HrImportIssue(
                code,
                required ? HrImportIssueSeverity.ERROR : HrImportIssueSeverity.WARNING,
                columnName(column) + row,
                field,
                required ? "Ngày bắt buộc không hợp lệ." : "Ngày tùy chọn không hợp lệ; hệ thống để trống."
        ));
    }

    private HrEmployeeGender gender(OoxmlCell cell, int row, List<HrImportIssue> issues) {
        String value = optionalText(cell, row, 9, "gender", 32, false, issues);
        if (value == null) {
            warning(issues, row, 9, "gender", HrImportIssueCode.UNKNOWN_GENDER,
                    "Không xác định được giới tính nguồn.");
            return HrEmployeeGender.UNKNOWN;
        }
        String key = normalizeKey(value);
        if ("NAM".equals(key)) return HrEmployeeGender.MALE;
        if ("NU".equals(key)) return HrEmployeeGender.FEMALE;
        warning(issues, row, 9, "gender", HrImportIssueCode.UNKNOWN_GENDER,
                "Giới tính nguồn chưa có mapping; dùng UNKNOWN.");
        return HrEmployeeGender.UNKNOWN;
    }

    private BigDecimal numericValue(OoxmlCell cell) {
        if (cell == null || !("NUMBER".equals(cell.type()) || "STRING".equals(cell.type()))) {
            throw new NumberFormatException();
        }
        return new BigDecimal(normalizeText(cell.value()).replace(",", ""));
    }

    private Map<String, byte[]> readSafePackage(byte[] workbookBytes) {
        if (workbookBytes == null || workbookBytes.length == 0 || workbookBytes.length > MAX_FILE_BYTES) {
            throw structural("FILE_SIZE_INVALID", "File XLSX rỗng hoặc vượt giới hạn 10 MB.");
        }
        if (workbookBytes.length < 4 || workbookBytes[0] != 'P' || workbookBytes[1] != 'K') {
            throw structural("FILE_TYPE_INVALID", "File upload không phải container XLSX hợp lệ.");
        }

        Map<String, byte[]> parts = new HashMap<>();
        int entryCount = 0;
        long totalSize = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(workbookBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entryCount++;
                String name = entry.getName().replace('\\', '/');
                String lower = name.toLowerCase(Locale.ROOT);
                if (entryCount > MAX_ZIP_ENTRIES || name.startsWith("/") || name.contains("../")) {
                    throw structural("UNSAFE_XLSX", "Cấu trúc ZIP của XLSX không an toàn.");
                }
                if (lower.endsWith("vbaproject.bin") || lower.contains("/externallinks/")) {
                    throw structural("UNSAFE_XLSX", "Macro hoặc external link không được phép.");
                }
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    totalSize += read;
                    if (totalSize > MAX_UNCOMPRESSED_BYTES) {
                        throw structural("UNSAFE_XLSX", "Nội dung giải nén vượt giới hạn an toàn.");
                    }
                    output.write(buffer, 0, read);
                }
                if (!entry.isDirectory()) parts.put(name, output.toByteArray());
                zip.closeEntry();
            }
        } catch (HrBaselineImportException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new HrBaselineImportException("INVALID_XLSX", "Không thể kiểm tra container XLSX.", exception);
        }
        return parts;
    }

    private void rejectExternalRelationships(Map<String, byte[]> parts) {
        for (Map.Entry<String, byte[]> entry : parts.entrySet()) {
            if (!entry.getKey().endsWith(".rels")) continue;
            NodeList relationships = xml(entry.getValue()).getElementsByTagNameNS("*", "Relationship");
            for (int index = 0; index < relationships.getLength(); index++) {
                Element relationship = (Element) relationships.item(index);
                if ("External".equalsIgnoreCase(relationship.getAttribute("TargetMode"))) {
                    throw structural("EXTERNAL_LINK_NOT_ALLOWED", "Workbook không được chứa external relationship.");
                }
            }
        }
    }

    private Map<String, String> workbookRelationshipTargets(byte[] relationshipsXml) {
        NodeList relationships = xml(relationshipsXml).getElementsByTagNameNS("*", "Relationship");
        Map<String, String> targets = new HashMap<>();
        for (int index = 0; index < relationships.getLength(); index++) {
            Element relationship = (Element) relationships.item(index);
            targets.put(relationship.getAttribute("Id"), relationship.getAttribute("Target"));
        }
        return targets;
    }

    private List<String> readSharedStrings(Map<String, byte[]> parts) {
        byte[] payload = parts.get("xl/sharedStrings.xml");
        if (payload == null) return List.of();
        NodeList items = xml(payload).getElementsByTagNameNS(MAIN_NS, "si");
        List<String> strings = new ArrayList<>(items.getLength());
        for (int index = 0; index < items.getLength(); index++) {
            strings.add(descendantText((Element) items.item(index), "t"));
        }
        return List.copyOf(strings);
    }

    private Map<String, OoxmlCell> readCells(Map<String, byte[]> parts, String part,
                                              List<String> sharedStrings) {
        NodeList nodes = xml(parts.get(part)).getElementsByTagNameNS(MAIN_NS, "c");
        Map<String, OoxmlCell> cells = new HashMap<>();
        for (int index = 0; index < nodes.getLength(); index++) {
            Element cell = (Element) nodes.item(index);
            String reference = cell.getAttribute("r");
            if (!CELL_REFERENCE.matcher(reference).matches()) {
                throw structural("CELL_REFERENCE_INVALID", "Workbook chứa cell reference không hợp lệ.");
            }
            String type = cell.getAttribute("t");
            String value;
            String semanticType;
            if ("inlineStr".equals(type)) {
                value = descendantText(cell, "t");
                semanticType = "STRING";
            } else {
                value = firstDescendantText(cell, "v");
                switch (type) {
                    case "s" -> {
                        try {
                            value = sharedStrings.get(Integer.parseInt(value));
                        } catch (RuntimeException exception) {
                            throw structural("SHARED_STRING_INVALID", "Shared string index không hợp lệ.");
                        }
                        semanticType = "STRING";
                    }
                    case "str" -> semanticType = "STRING";
                    case "e" -> semanticType = "ERROR";
                    case "b" -> semanticType = "BOOLEAN";
                    case "d" -> semanticType = "DATE";
                    default -> semanticType = value == null || value.isBlank() ? "BLANK" : "NUMBER";
                }
            }
            cells.put(reference, new OoxmlCell(semanticType, value));
        }
        return cells;
    }

    private Document xml(byte[] payload) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            return factory.newDocumentBuilder().parse(new ByteArrayInputStream(payload));
        } catch (ParserConfigurationException | SAXException | IOException exception) {
            throw new HrBaselineImportException("INVALID_XML", "OOXML chứa XML không hợp lệ hoặc không an toàn.", exception);
        }
    }

    private static String firstDescendantText(Element element, String localName) {
        NodeList nodes = element.getElementsByTagNameNS(MAIN_NS, localName);
        return nodes.getLength() == 0 ? null : nodes.item(0).getTextContent();
    }

    private static String descendantText(Element element, String localName) {
        NodeList nodes = element.getElementsByTagNameNS(MAIN_NS, localName);
        StringBuilder value = new StringBuilder();
        for (int index = 0; index < nodes.getLength(); index++) value.append(nodes.item(index).getTextContent());
        return value.toString();
    }

    private static String resolvePart(String sourcePart, String target) {
        if (target.startsWith("/")) return target.substring(1);
        Path base = Path.of(sourcePart).getParent();
        String resolved = base.resolve(target).normalize().toString().replace('\\', '/');
        if (resolved.startsWith("../")) {
            throw structural("UNSAFE_RELATIONSHIP", "Relationship trỏ ra ngoài package.");
        }
        return resolved;
    }

    private static void requirePart(Map<String, byte[]> parts, String name) {
        if (!parts.containsKey(name)) {
            throw structural("PACKAGE_PART_MISSING", "Workbook thiếu OOXML part bắt buộc.");
        }
    }

    private static OoxmlCell value(Map<String, OoxmlCell> cells, int column, int row) {
        return cells.get(columnName(column) + row);
    }

    private static HrRawCell rawCell(OoxmlCell cell) {
        return cell == null ? new HrRawCell("BLANK", null) : new HrRawCell(cell.type(), cell.value());
    }

    private static boolean isBlank(OoxmlCell cell) {
        return cell == null || "BLANK".equals(cell.type()) || cell.value() == null || cell.value().isBlank();
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String canonicalNumberText(String value) {
        BigDecimal number = new BigDecimal(value).stripTrailingZeros();
        return number.scale() < 0 ? number.setScale(0).toPlainString() : number.toPlainString();
    }

    private static String normalizeHeader(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? "" : normalized.toUpperCase(Locale.ROOT);
    }

    private static String normalizeText(String value) {
        if (value == null) return null;
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC)
                .replace('\u00A0', ' ')
                .trim()
                .replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }

    private static String normalizeKey(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "");
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static CellCoordinate coordinate(String reference) {
        Matcher matcher = CELL_REFERENCE.matcher(reference);
        if (!matcher.matches()) throw structural("CELL_REFERENCE_INVALID", "Cell reference không hợp lệ.");
        return new CellCoordinate(columnIndex(matcher.group(1)), Integer.parseInt(matcher.group(2)));
    }

    private static int columnIndex(String name) {
        int result = 0;
        for (int index = 0; index < name.length(); index++) result = result * 26 + name.charAt(index) - 'A' + 1;
        return result - 1;
    }

    private static String columnName(int zeroBasedColumn) {
        int value = zeroBasedColumn + 1;
        StringBuilder name = new StringBuilder();
        while (value > 0) {
            int remainder = (value - 1) % 26;
            name.append((char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return name.reverse().toString();
    }

    private static void warning(List<HrImportIssue> issues, int row, int column, String field,
                                HrImportIssueCode code, String message) {
        issues.add(new HrImportIssue(code, HrImportIssueSeverity.WARNING,
                columnName(column) + row, field, message));
    }

    private static void error(List<HrImportIssue> issues, int row, int column, String field,
                              HrImportIssueCode code, String message) {
        issues.add(new HrImportIssue(code, HrImportIssueSeverity.ERROR,
                columnName(column) + row, field, message));
    }

    private static HrBaselineImportException structural(String code, String message) {
        return new HrBaselineImportException(code, message);
    }

    private record WorkbookContract(String sourceSheetPart, List<String> sharedStrings) {
    }

    private record OoxmlCell(String type, String value) {
        private boolean isBlank() {
            return "BLANK".equals(type) || value == null || value.isBlank();
        }
    }

    private record CellCoordinate(int column, int row) {
    }

    private static final class DateOutOfRangeException extends RuntimeException {
    }
}

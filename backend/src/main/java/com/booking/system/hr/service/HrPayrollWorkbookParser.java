package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Component
public class HrPayrollWorkbookParser {
    /** Kept for source compatibility; sheet selection is now structure-based. */
    @Deprecated
    public static final String SHEET_NAME = "VIETIN - PBHOACHAT";
    private static final int MAX_FILE_BYTES = 15 * 1024 * 1024;
    private static final int MAX_HEADER_ROWS = 30;
    private static final int MAX_ZIP_ENTRIES = 256;
    private static final long MAX_UNCOMPRESSED_BYTES = 40L * 1024 * 1024;
    private static final String MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static final String REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static final Pattern CELL_REF = Pattern.compile("^([A-Z]+)([0-9]+)$");
    private static final Pattern MONTH = Pattern.compile("th[aá]ng\\s*(\\d{1,2})\\s*[/-]\\s*(\\d{4})", Pattern.CASE_INSENSITIVE);
    private static final List<String> REQUIRED = List.of("stt", "maNv", "hoTen", "stk", "cong", "tienLuong", "tongThu", "nganHangChuyen");
    private static final Map<String, List<String>> ALIASES = Map.ofEntries(
            Map.entry("stt", List.of("stt")),
            Map.entry("maNv", List.of("mã số", "mã nv", "manv")),
            Map.entry("hoTen", List.of("họ và tên", "họ tên")),
            Map.entry("stk", List.of("số tài khoản", "stk")),
            Map.entry("plh", List.of("p+l+h", "p l h", "f+l", "f l")),
            Map.entry("cong", List.of("công")),
            Map.entry("tienLuong", List.of("tiền lương")),
            Map.entry("tongThu", List.of("tổng thu")),
            Map.entry("bhxh", List.of("bhxh 10,5%", "bhxh 10.5%", "bhxh")),
            Map.entry("baoGiat", List.of("b giặt", "b giat")),
            Map.entry("htkk", List.of("htkk")),
            Map.entry("thuDangPhi", List.of("đảng phí", "dang phi", "thu đang phí", "thudang phí")),
            Map.entry("doanPhi", List.of("đoàn phí", "doan phi", "thu đp", "thu dp")),
            Map.entry("asxh", List.of("asxh")),
            Map.entry("xhhc", List.of("xhhc")),
            Map.entry("ttn", List.of("ttn")),
            Map.entry("nganHangChuyen", List.of("nh chuyển", "ngân hàng chuyển", "ngan hang chuyen"))
    );

    public ParsedWorkbook parse(byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw HrApiException.badRequest("PAYROLL_FILE_EMPTY", "File lương rỗng.");
        if (bytes.length > MAX_FILE_BYTES) throw HrApiException.badRequest("PAYROLL_FILE_TOO_LARGE", "File lương không được vượt quá 15 MB.");
        if (bytes.length < 4 || bytes[0] != 'P' || bytes[1] != 'K') {
            throw HrApiException.badRequest("PAYROLL_XLSX_REQUIRED", "Chỉ chấp nhận file Excel .xlsx.");
        }
        try {
            Map<String, byte[]> parts = readZip(bytes);
            Document workbook = xml(required(parts, "xl/workbook.xml"));
            Map<String, String> relationships = relationships(required(parts, "xl/_rels/workbook.xml.rels"));
            List<String> shared = sharedStrings(parts.get("xl/sharedStrings.xml"));
            String selectedSheetName = null;
            String sheetPart = null;
            Map<Integer, Map<Integer, String>> rows = null;
            int headerRow = 0;
            NodeList sheets = workbook.getElementsByTagNameNS(MAIN_NS, "sheet");
            for (int i = 0; i < sheets.getLength(); i++) {
                Element sheet = (Element) sheets.item(i);
                String target = relationships.get(sheet.getAttributeNS(REL_NS, "id"));
                String candidatePart = resolve("xl/workbook.xml", target);
                if (candidatePart == null || !parts.containsKey(candidatePart)) continue;
                Map<Integer, Map<Integer, String>> candidateRows = cells(parts.get(candidatePart), shared);
                Integer candidateHeaderRow = findHeaderRowOrNull(candidateRows);
                if (candidateHeaderRow != null) {
                    selectedSheetName = sheet.getAttribute("name");
                    sheetPart = candidatePart;
                    rows = candidateRows;
                    headerRow = candidateHeaderRow;
                    break;
                }
            }
            if (sheetPart == null || rows == null) {
                throw HrApiException.badRequest("PAYROLL_HEADER_INVALID", "Không tìm thấy sheet bảng lương có đủ các cột bắt buộc trong 30 dòng đầu.");
            }
            Map<String, Integer> columns = headerColumns(rows.get(headerRow));
            String month = extractMonth(rows, headerRow);
            List<PayrollRow> parsed = new ArrayList<>();
            Set<String> seenEmployeeCodes = new HashSet<>();
            for (int rowNumber = headerRow + 1; rowNumber <= rows.keySet().stream().mapToInt(Integer::intValue).max().orElse(headerRow); rowNumber++) {
                Map<Integer, String> row = rows.getOrDefault(rowNumber, Map.of());
                if (isBlank(row, columns)) {
                    if (!parsed.isEmpty()) break;
                    continue;
                }
                String code = text(row, columns, "maNv").toUpperCase(Locale.ROOT);
                String name = text(row, columns, "hoTen");
                if (normalizeKey(name).contains("tongcong") || normalizeKey(name).contains("congcong")) break;
                if (text(row, columns, "stt").isBlank() || code.isBlank() || name.isBlank()) {
                    if (!parsed.isEmpty()) break;
                    continue;
                }
                Map<String, Object> values = new LinkedHashMap<>();
                for (String field : columns.keySet()) {
                    String value = text(row, columns, field);
                    values.put(field, numericField(field) ? number(value) : value);
                }
                if (!seenEmployeeCodes.add(code)) {
                    throw HrApiException.badRequest("PAYROLL_DUPLICATE_EMPLOYEE", "Mã nhân viên " + code + " xuất hiện nhiều lần trong file.");
                }
                parsed.add(new PayrollRow(rowNumber, code, name, text(row, columns, "stk"), values));
            }
            if (parsed.isEmpty()) throw HrApiException.badRequest("PAYROLL_NO_ROWS", "Không tìm thấy dòng nhân viên hợp lệ trong file lương.");
            return new ParsedWorkbook(sha256(bytes), bytes.length, selectedSheetName, month, parsed);
        } catch (HrApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw HrApiException.badRequest("PAYROLL_XLSX_INVALID", "Không thể đọc file Excel lương.");
        }
    }

    private static boolean numericField(String field) { return !SetFields.TEXT.contains(field); }
    private static final class SetFields { private static final java.util.Set<String> TEXT = java.util.Set.of("stt", "maNv", "hoTen", "stk"); }
    private static BigDecimal number(String value) {
        if (value == null || value.isBlank()) return BigDecimal.ZERO;
        String normalized = value.replaceAll("[^0-9.-]", "");
        if (normalized.isBlank() || normalized.equals("-") || normalized.equals(".")) return BigDecimal.ZERO;
        try { return new BigDecimal(normalized); } catch (NumberFormatException ignored) { return BigDecimal.ZERO; }
    }
    private static boolean isBlank(Map<Integer, String> row, Map<String, Integer> columns) {
        return columns.values().stream().allMatch(index -> row.getOrDefault(index, "").isBlank());
    }
    private static String text(Map<Integer, String> row, Map<String, Integer> columns, String field) { return row.getOrDefault(columns.getOrDefault(field, -1), "").trim(); }
    private static Integer findHeaderRowOrNull(Map<Integer, Map<Integer, String>> rows) {
        for (int row = 1; row <= MAX_HEADER_ROWS; row++) {
            Map<String, Integer> columns = headerColumns(rows.getOrDefault(row, Map.of()));
            if (REQUIRED.stream().allMatch(columns::containsKey)) return row;
        }
        return null;
    }
    private static Map<String, Integer> headerColumns(Map<Integer, String> row) {
        Map<String, Integer> result = new LinkedHashMap<>();
        row.forEach((index, value) -> ALIASES.forEach((field, aliases) -> {
            if (!result.containsKey(field) && aliases.stream().anyMatch(alias -> normalizeKey(alias).equals(normalizeKey(value)))) result.put(field, index);
        }));
        return result;
    }
    private static String extractMonth(Map<Integer, Map<Integer, String>> rows, int headerRow) {
        for (int row = 1; row <= Math.min(MAX_HEADER_ROWS, headerRow); row++) for (String value : rows.getOrDefault(row, Map.of()).values()) {
            Matcher matcher = MONTH.matcher(value);
            if (matcher.find()) return String.format("%02d/%s", Integer.parseInt(matcher.group(1)), matcher.group(2));
        }
        throw HrApiException.badRequest("PAYROLL_MONTH_NOT_FOUND", "Không xác định được tháng lương trong phần tiêu đề file.");
    }
    private static String normalizeKey(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }
    private static Map<Integer, Map<Integer, String>> cells(byte[] bytes, List<String> shared) throws Exception {
        Document document = xml(bytes); Map<Integer, Map<Integer, String>> rows = new HashMap<>();
        NodeList cells = document.getElementsByTagNameNS(MAIN_NS, "c");
        for (int i = 0; i < cells.getLength(); i++) {
            Element cell = (Element) cells.item(i); Matcher matcher = CELL_REF.matcher(cell.getAttribute("r")); if (!matcher.matches()) continue;
            int row = Integer.parseInt(matcher.group(2)); int column = columnNumber(matcher.group(1)); String value = "";
            NodeList inline = cell.getElementsByTagNameNS(MAIN_NS, "t");
            if ("inlineStr".equals(cell.getAttribute("t")) && inline.getLength() > 0) value = inline.item(0).getTextContent();
            else { NodeList values = cell.getElementsByTagNameNS(MAIN_NS, "v"); if (values.getLength() > 0) value = values.item(0).getTextContent(); if ("s".equals(cell.getAttribute("t")) && !value.isBlank()) value = shared.get(Integer.parseInt(value)); }
            rows.computeIfAbsent(row, ignored -> new HashMap<>()).put(column, value);
        }
        return rows;
    }
    private static int columnNumber(String letters) { int result = 0; for (char character : letters.toCharArray()) result = result * 26 + character - 'A' + 1; return result - 1; }
    private static List<String> sharedStrings(byte[] bytes) throws Exception { if (bytes == null) return List.of(); Document document = xml(bytes); NodeList items = document.getElementsByTagNameNS(MAIN_NS, "si"); List<String> result = new ArrayList<>(); for (int i = 0; i < items.getLength(); i++) result.add(items.item(i).getTextContent()); return result; }
    private static Map<String, String> relationships(byte[] bytes) throws Exception { Document document = xml(bytes); Map<String, String> result = new HashMap<>(); NodeList nodes = document.getElementsByTagName("Relationship"); for (int i = 0; i < nodes.getLength(); i++) { Element node = (Element) nodes.item(i); result.put(node.getAttribute("Id"), node.getAttribute("Target")); } return result; }
    private static String resolve(String base, String target) { if (target == null) return null; if (target.startsWith("/")) return target.substring(1); int slash = base.lastIndexOf('/'); String path = slash < 0 ? target : base.substring(0, slash + 1) + target; while (path.contains("../")) path = path.replaceFirst("[^/]+/\\.\\./", ""); return path; }
    private static byte[] required(Map<String, byte[]> parts, String name) { byte[] value = parts.get(name); if (value == null) throw HrApiException.badRequest("PAYROLL_XLSX_INVALID", "Workbook thiếu thành phần " + name + "."); return value; }
    private static Map<String, byte[]> readZip(byte[] bytes) throws Exception { Map<String, byte[]> result = new HashMap<>(); long total = 0; int count = 0; try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(bytes))) { ZipEntry entry; while ((entry = input.getNextEntry()) != null) { if (++count > MAX_ZIP_ENTRIES || entry.isDirectory() || entry.getName().contains("..")) throw HrApiException.badRequest("PAYROLL_XLSX_INVALID", "File Excel không hợp lệ."); ByteArrayOutputStream output = new ByteArrayOutputStream(); input.transferTo(output); total += output.size(); if (total > MAX_UNCOMPRESSED_BYTES) throw HrApiException.badRequest("PAYROLL_XLSX_TOO_LARGE", "Dữ liệu giải nén vượt giới hạn an toàn."); result.put(entry.getName(), output.toByteArray()); } } return result; }
    private static Document xml(byte[] bytes) throws Exception { DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance(); factory.setNamespaceAware(true); factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true); factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, ""); return factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes)); }
    private static String sha256(byte[] bytes) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }

    public record ParsedWorkbook(String sha256, long fileSize, String sheetName, String payrollMonth, List<PayrollRow> rows) {}
    public record PayrollRow(int rowNumber, String employeeCode, String employeeName, String bankAccount, Map<String, Object> values) {}
}

package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeContact;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeIdentity;
import com.booking.system.hr.entity.HrEmployeeInsurance;
import com.booking.system.hr.entity.HrEmployeeMovement;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.entity.HrMonthlyRosterItem;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrMovementStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HrExcelExportService {

    private static final String RESOURCE_TEMPLATE_PATH = "/hr/templates/workforce-export-template.xlsx";
    private static final List<Path> TEMPLATE_PATHS = List.of(
            Path.of("docs/hr-template/workforce-baseline-339-2026.xlsx"),
            Path.of("../docs/hr-template/workforce-baseline-339-2026.xlsx")
    );
    private static final EnumSet<HrMovementType> EXPORT_MOVEMENT_TYPES = EnumSet.of(
            HrMovementType.INCREASE,
            HrMovementType.DECREASE
    );
    private static final Pattern ROW_PATTERN = Pattern.compile("<row\\b[^>]*\\br=\\\"(\\d+)\\\"[^>]*>.*?</row>", Pattern.DOTALL);
    private static final Pattern CELL_PATTERN = Pattern.compile("<c\\b([^>]*)>");
    private static final Pattern CELL_REF_PATTERN = Pattern.compile("\\br=\\\"([A-Z]+)\\d+\\\"");
    private static final Pattern CELL_STYLE_PATTERN = Pattern.compile("\\bs=\\\"([^\\\"]+)\\\"");
    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    private final HrMonthlyRosterRepository rosterRepository;
    private final HrMonthlyRosterItemRepository rosterItemRepository;
    private final HrEmployeeMovementRepository movementRepository;

    public ExportFile exportMonth(int year, int month) {
        LocalDate periodStart = periodStart(year, month);
        LocalDate periodEnd = periodStart.plusMonths(1).minusDays(1);
        HrMonthlyRoster roster = rosterRepository.findByPeriodStart(periodStart).orElse(null);
        List<HrEmployeeMovement> movements = confirmedMovements(periodStart, periodEnd);

        List<SheetPlan> sheets = List.of(
                new SheetPlan("TĂNG", "xl/worksheets/sheet1.xml"),
                new SheetPlan("GIẢM", "xl/worksheets/sheet2.xml"),
                new SheetPlan(monthSheetName(periodStart), "xl/worksheets/sheet3.xml")
        );

        Map<String, byte[]> entries = templateEntries();
        applyWorkbookPlan(entries, sheets);
        entries.put("xl/worksheets/sheet1.xml", sheetBytes(movementSheetXml(entries, "xl/worksheets/sheet1.xml", movements, HrMovementType.INCREASE)));
        entries.put("xl/worksheets/sheet2.xml", sheetBytes(movementSheetXml(entries, "xl/worksheets/sheet2.xml", movements, HrMovementType.DECREASE)));
        entries.put("xl/worksheets/sheet3.xml", sheetBytes(rosterSheetXml(entries, roster, periodStart, true)));

        return new ExportFile(
                "hr-" + monthSheetName(periodStart) + ".xlsx",
                zip(entries)
        );
    }

    public ExportFile exportYear(int year) {
        requireYear(year);
        LocalDate yearStart = LocalDate.of(year, 1, 1);
        LocalDate yearEnd = LocalDate.of(year, 12, 31);
        List<HrEmployeeMovement> movements = confirmedMovements(yearStart, yearEnd);
        Map<LocalDate, HrMonthlyRoster> rosters = new LinkedHashMap<>();
        for (HrMonthlyRoster roster : rosterRepository.findAllByPeriodStartBetweenOrderByPeriodStartAsc(yearStart, yearEnd)) {
            rosters.put(roster.getPeriodStart(), roster);
        }

        List<SheetPlan> sheets = new ArrayList<>();
        sheets.add(new SheetPlan("TĂNG", "xl/worksheets/sheet1.xml"));
        sheets.add(new SheetPlan("GIẢM", "xl/worksheets/sheet2.xml"));
        for (int month = 1; month <= 12; month++) {
            sheets.add(new SheetPlan(monthSheetName(LocalDate.of(year, month, 1)), "xl/worksheets/sheet" + (month + 2) + ".xml"));
        }

        Map<String, byte[]> entries = templateEntries();
        applyWorkbookPlan(entries, sheets);
        entries.put("xl/worksheets/sheet1.xml", sheetBytes(movementSheetXml(entries, "xl/worksheets/sheet1.xml", movements, HrMovementType.INCREASE)));
        entries.put("xl/worksheets/sheet2.xml", sheetBytes(movementSheetXml(entries, "xl/worksheets/sheet2.xml", movements, HrMovementType.DECREASE)));
        for (int month = 1; month <= 12; month++) {
            LocalDate periodStart = LocalDate.of(year, month, 1);
            String sheetPath = "xl/worksheets/sheet" + (month + 2) + ".xml";
            entries.put(sheetPath, sheetBytes(rosterSheetXml(entries, rosters.get(periodStart), periodStart, month == 1)));
        }

        return new ExportFile("hr-nam-" + year + ".xlsx", zip(entries));
    }

    private List<HrEmployeeMovement> confirmedMovements(LocalDate from, LocalDate to) {
        return movementRepository.findConfirmedForExport(
                HrMovementStatus.CONFIRMED,
                EXPORT_MOVEMENT_TYPES,
                from,
                to
        );
    }

    private String movementSheetXml(Map<String, byte[]> entries, String path, List<HrEmployeeMovement> movements, HrMovementType type) {
        String template = text(entries, path);
        boolean increase = type == HrMovementType.INCREASE;
        int dataStartRow = increase ? 13 : 9;
        int columnCount = increase ? 12 : 10;
        List<List<CellValue>> rows = new ArrayList<>();
        int order = 1;
        for (HrEmployeeMovement movement : movements) {
            if (movement.getMovementType() != type) {
                continue;
            }
            rows.add(increase ? increaseMovementRow(movement, order++) : decreaseMovementRow(movement, order++));
        }
        return rewriteSheetData(template, dataStartRow, columnCount, rows, increase ? "L" : "J", false);
    }

    private List<CellValue> increaseMovementRow(HrEmployeeMovement movement, int order) {
        HrEmployee employee = movement.getEmployee();
        HrEmployeeEmployment employment = employee == null ? null : employee.getEmployment();
        HrEmployeeInsurance insurance = employee == null ? null : employee.getInsurance();
        return List.of(
                number(movement.getEffectiveDate() == null ? null : movement.getEffectiveDate().getMonthValue()),
                number(order),
                text(employee == null ? null : employee.getEmployeeCode()),
                text(employee == null ? null : employee.getFullName()),
                date(employee == null ? null : employee.getDateOfBirth()),
                text(employment == null ? null : employment.getContractNumber()),
                date(firstDate(movement.getDecisionDate(), movement.getEffectiveDate())),
                text(catalogName(firstCatalog(movement.getToDepartment(), employment == null ? null : employment.getDepartment()))),
                decimal(employment == null ? null : employment.getBaseSalary()),
                text(insurance == null ? null : insurance.getSocialInsuranceNumber()),
                text(null),
                text(movement.getReason())
        );
    }

    private List<CellValue> decreaseMovementRow(HrEmployeeMovement movement, int order) {
        HrEmployee employee = movement.getEmployee();
        HrEmployeeEmployment employment = employee == null ? null : employee.getEmployment();
        return List.of(
                text(movement.getEffectiveDate() == null ? "" : "%02d".formatted(movement.getEffectiveDate().getMonthValue())),
                number(order),
                text(employee == null ? null : employee.getEmployeeCode()),
                text(employee == null ? null : employee.getFullName()),
                date(employee == null ? null : employee.getDateOfBirth()),
                date(employment == null ? null : employment.getHireDate()),
                text(movement.getDecisionNumber()),
                date(firstDate(movement.getDecisionDate(), movement.getEffectiveDate())),
                text(catalogName(firstCatalog(movement.getFromDepartment(), employment == null ? null : employment.getDepartment()))),
                text(movement.getReason())
        );
    }

    private String rosterSheetXml(Map<String, byte[]> entries, HrMonthlyRoster roster, LocalDate periodStart, boolean keepDrawings) {
        String template = text(entries, "xl/worksheets/sheet3.xml");
        List<List<CellValue>> rows = new ArrayList<>();
        if (roster != null) {
            for (HrMonthlyRosterItem item : rosterItemRepository.findAllByRoster_IdOrderByDisplayOrder(roster.getId())) {
                rows.add(rosterRow(item, periodStart));
            }
        }
        String xml = rewriteSheetData(template, 5, 34, rows, "AH", true);
        xml = xml.replaceFirst("<dimension ref=\\\"[^\\\"]+\\\"", "<dimension ref=\"A1:AH" + Math.max(4, rows.size() + 4) + "\"");
        xml = xml.replaceFirst("<autoFilter ref=\\\"[^\\\"]+\\\"", "<autoFilter ref=\"A4:AH" + Math.max(4, rows.size() + 4) + "\"");
        if (!keepDrawings) {
            xml = xml.replaceAll("<drawing\\b[^>]*/>", "");
            xml = xml.replaceAll("<legacyDrawing\\b[^>]*/>", "");
        }
        return xml;
    }

    private List<CellValue> rosterRow(HrMonthlyRosterItem item, LocalDate periodStart) {
        HrEmployee employee = item.getEmployee();
        HrEmployeeEmployment employment = employee == null ? null : employee.getEmployment();
        HrEmployeeInsurance insurance = employee == null ? null : employee.getInsurance();
        HrEmployeeIdentity identity = employee == null ? null : employee.getIdentity();
        HrEmployeeContact contact = employee == null ? null : employee.getContact();
        BigDecimal baseSalary = employment == null ? null : employment.getBaseSalary();
        BigDecimal allowance = employment == null ? null : employment.getAllowance();
        BigDecimal totalIncome = baseSalary == null ? allowance : allowance == null ? baseSalary : baseSalary.add(allowance);
        LocalDate birthDate = employee == null ? null : employee.getDateOfBirth();
        LocalDate hireDate = firstDate(item.getHireDate(), employment == null ? null : employment.getHireDate());
        return List.of(
                number(item.getDisplayOrder()),
                number(item.getDepartmentDisplayOrder()),
                text(item.getEmployeeCode()),
                text(insurance == null ? null : insurance.getSocialInsuranceNumber()),
                text(item.getFullName()),
                text(insurance == null ? null : insurance.getHealthInsuranceNumber()),
                decimal(baseSalary),
                decimal(allowance),
                decimal(totalIncome),
                text(genderLabel(employee == null ? null : employee.getGender())),
                text(employee == null ? null : employee.getEthnicity()),
                text(employee == null ? null : employee.getReligion()),
                text(item.getPositionName()),
                text(item.getDepartmentName()),
                date(birthDate),
                date(hireDate),
                text(employment == null ? null : employment.getContractTypeLabel()),
                text(employment == null ? null : employment.getContractNumber()),
                text(tenureLabel(hireDate, periodStart.plusMonths(1).minusDays(1))),
                text(identity == null ? null : identity.getLegacyIdentityNumber()),
                text(identity == null ? null : identity.getCitizenIdentityNumber()),
                date(identity == null ? null : identity.getIssuedDate()),
                text(item.getWorkingConditionName()),
                text(identity == null ? null : identity.getIssuedPlace()),
                text(employee == null ? null : employee.getBirthPlaceOriginal()),
                text(employee == null ? null : employee.getBirthPlaceCurrent()),
                text(contact == null ? null : contact.getPermanentAddress()),
                text(contact == null ? null : contact.getCurrentAddress()),
                text(contact == null ? null : contact.getPhone()),
                text(employee == null ? null : employee.getEducationLevel()),
                text(employee == null ? null : employee.getMajor()),
                text(employment == null ? null : employment.getJobDescription()),
                number(age(birthDate, periodStart.plusMonths(1).minusDays(1))),
                decimal(item.getLeaveDays())
        );
    }

    private String rewriteSheetData(String template, int dataStartRow, int columnCount, List<List<CellValue>> rows, String lastColumn, boolean keepBlankTemplateRows) {
        int sheetDataStart = template.indexOf("<sheetData>");
        int sheetDataOpenEnd = template.indexOf('>', sheetDataStart) + 1;
        int sheetDataClose = template.indexOf("</sheetData>");
        if (sheetDataStart < 0 || sheetDataClose < 0) {
            throw new IllegalStateException("File template Excel không có sheetData hợp lệ.");
        }
        String beforeRows = template.substring(0, sheetDataOpenEnd);
        String sheetData = template.substring(sheetDataOpenEnd, sheetDataClose);
        String afterRows = template.substring(sheetDataClose);
        StringBuilder rebuilt = new StringBuilder(beforeRows);
        Matcher matcher = ROW_PATTERN.matcher(sheetData);
        while (matcher.find()) {
            int rowNumber = Integer.parseInt(matcher.group(1));
            if (rowNumber < dataStartRow) {
                rebuilt.append(matcher.group());
            }
        }

        RowTemplate rowTemplate = rowTemplate(sheetData, dataStartRow, columnCount);
        int rowCount = keepBlankTemplateRows ? Math.max(rows.size(), rowTemplate.originalDataRows()) : rows.size();
        for (int index = 0; index < rowCount; index++) {
            List<CellValue> values = index < rows.size() ? rows.get(index) : List.of();
            rebuilt.append(rowXml(rowTemplate, dataStartRow + index, values));
        }
        int lastRow = Math.max(dataStartRow - 1, dataStartRow + rowCount - 1);
        rebuilt.append(afterRows);
        return rebuilt.toString()
                .replaceFirst("<dimension ref=\\\"[^\\\"]+\\\"", "<dimension ref=\"A1:" + lastColumn + lastRow + "\"")
                .replaceFirst("<autoFilter ref=\\\"[^\\\"]+\\\"", "<autoFilter ref=\"A" + (dataStartRow - 1) + ":" + lastColumn + lastRow + "\"");
    }

    private RowTemplate rowTemplate(String sheetData, int dataStartRow, int columnCount) {
        String rowXml = findRow(sheetData, dataStartRow);
        String rowAttributes = firstMatch(rowXml, Pattern.compile("<row\\b([^>]*)>"));
        rowAttributes = rowAttributes.replaceFirst("\\s*r=\\\"[^\\\"]+\\\"", "");
        Map<String, String> styles = new LinkedHashMap<>();
        Matcher cellMatcher = CELL_PATTERN.matcher(rowXml);
        while (cellMatcher.find()) {
            String attrs = cellMatcher.group(1);
            Matcher ref = CELL_REF_PATTERN.matcher(attrs);
            Matcher style = CELL_STYLE_PATTERN.matcher(attrs);
            if (ref.find() && style.find()) {
                styles.put(ref.group(1), style.group(1));
            }
        }
        int originalRows = 0;
        Matcher matcher = ROW_PATTERN.matcher(sheetData);
        while (matcher.find()) {
            if (Integer.parseInt(matcher.group(1)) >= dataStartRow) {
                originalRows++;
            }
        }
        return new RowTemplate(rowAttributes, styles, columnCount, originalRows);
    }

    private static String findRow(String sheetData, int rowNumber) {
        Matcher matcher = Pattern.compile("<row\\b[^>]*\\br=\\\"" + rowNumber + "\\\"[^>]*>.*?</row>", Pattern.DOTALL).matcher(sheetData);
        if (!matcher.find()) {
            throw new IllegalStateException("File template Excel thiếu dòng mẫu " + rowNumber + ".");
        }
        return matcher.group();
    }

    private static String firstMatch(String value, Pattern pattern) {
        Matcher matcher = pattern.matcher(value);
        if (!matcher.find()) {
            return "";
        }
        return matcher.group(1);
    }

    private String rowXml(RowTemplate template, int rowNumber, List<CellValue> values) {
        StringBuilder xml = new StringBuilder();
        xml.append("<row r=\"").append(rowNumber).append("\"").append(template.rowAttributes()).append(">");
        for (int columnIndex = 1; columnIndex <= template.columnCount(); columnIndex++) {
            CellValue value = columnIndex <= values.size() ? values.get(columnIndex - 1) : CellValue.blank();
            xml.append(cellXml(columnName(columnIndex), rowNumber, template.styles().get(columnName(columnIndex)), value));
        }
        xml.append("</row>");
        return xml.toString();
    }

    private static String cellXml(String column, int rowNumber, String style, CellValue value) {
        String ref = column + rowNumber;
        String styleAttr = style == null ? "" : " s=\"" + style + "\"";
        if (value == null || value.isBlank()) {
            return "<c r=\"" + ref + "\"" + styleAttr + "/>";
        }
        if (value.type() == CellType.NUMBER || value.type() == CellType.DATE) {
            return "<c r=\"" + ref + "\"" + styleAttr + " t=\"n\"><v>" + value.value() + "</v></c>";
        }
        return "<c r=\"" + ref + "\"" + styleAttr + " t=\"inlineStr\"><is><t" + xmlSpace(value.value()) + ">"
                + escape(value.value()) + "</t></is></c>";
    }

    private static String xmlSpace(String value) {
        if (value.startsWith(" ") || value.endsWith(" ") || value.contains("\n")) {
            return " xml:space=\"preserve\"";
        }
        return "";
    }

    private Map<String, byte[]> templateEntries() {
        byte[] template = readTemplateFromResources();
        if (template == null) {
            template = readTemplateFromLocalDocs();
        }
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(template), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), zip.readAllBytes());
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc file mẫu Excel HR.", exception);
        }
        return entries;
    }

    private static byte[] readTemplateFromResources() {
        try (InputStream input = HrExcelExportService.class.getResourceAsStream(RESOURCE_TEMPLATE_PATH)) {
            return input == null ? null : input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc file mẫu Excel HR trong backend resources.", exception);
        }
    }

    private static byte[] readTemplateFromLocalDocs() {
        Path templatePath = TEMPLATE_PATHS.stream()
                .filter(Files::isRegularFile)
                .findFirst()
                .orElse(null);
        if (templatePath == null) {
            throw HrApiException.badRequest(
                    "HR_EXPORT_TEMPLATE_MISSING",
                    "Không tìm thấy file mẫu Excel HR trong backend resources hoặc docs/hr-template."
            );
        }
        try {
            return Files.readAllBytes(templatePath);
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc file mẫu Excel HR.", exception);
        }
    }

    private void applyWorkbookPlan(Map<String, byte[]> entries, List<SheetPlan> sheets) {
        entries.put("xl/workbook.xml", sheetBytes(workbookXml(sheets)));
        entries.put("xl/_rels/workbook.xml.rels", sheetBytes(workbookRelationships(sheets.size())));
        entries.put("[Content_Types].xml", sheetBytes(contentTypes(text(entries, "[Content_Types].xml"), sheets.size())));
        entries.put("docProps/app.xml", sheetBytes(appProperties(sheets)));
        for (int index = 4; index <= sheets.size(); index++) {
            entries.putIfAbsent("xl/worksheets/sheet" + index + ".xml", entries.get("xl/worksheets/sheet3.xml"));
        }
    }

    private static String workbookXml(List<SheetPlan> sheets) {
        StringBuilder sheetXml = new StringBuilder();
        for (int index = 0; index < sheets.size(); index++) {
            sheetXml.append("<sheet name=\"")
                    .append(escapeAttribute(sheets.get(index).name()))
                    .append("\" sheetId=\"")
                    .append(index + 1)
                    .append("\" state=\"visible\" r:id=\"rId")
                    .append(index + 3)
                    .append("\"/>");
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheets>%s</sheets>
                </workbook>
                """.formatted(sheetXml);
    }

    private static String workbookRelationships(int sheetCount) {
        StringBuilder relationships = new StringBuilder();
        relationships.append("""
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                """);
        for (int index = 1; index <= sheetCount; index++) {
            relationships.append("<Relationship Id=\"rId")
                    .append(index + 2)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                    .append(index)
                    .append(".xml\"/>");
        }
        relationships.append("<Relationship Id=\"rId").append(sheetCount + 3)
                .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/>");
        relationships.append("</Relationships>");
        return relationships.toString();
    }

    private static String contentTypes(String template, int sheetCount) {
        String contentTypes = template.replaceAll("<Override PartName=\"/xl/worksheets/sheet\\d+\\.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet\\+xml\"/>", "");
        StringBuilder overrides = new StringBuilder();
        for (int index = 1; index <= sheetCount; index++) {
            overrides.append("<Override PartName=\"/xl/worksheets/sheet")
                    .append(index)
                    .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
        }
        return contentTypes.replace("<Override PartName=\"/xl/sharedStrings.xml\"", overrides + "<Override PartName=\"/xl/sharedStrings.xml\"");
    }

    private static String appProperties(List<SheetPlan> sheets) {
        StringBuilder titles = new StringBuilder();
        for (SheetPlan sheet : sheets) {
            titles.append("<vt:lpstr>").append(escape(sheet.name())).append("</vt:lpstr>");
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
                <Application>CFC Base</Application>
                <TitlesOfParts><vt:vector size="%d" baseType="lpstr">%s</vt:vector></TitlesOfParts>
                <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>%d</vt:i4></vt:variant></vt:vector></HeadingPairs>
                </Properties>
                """.formatted(sheets.size(), titles, sheets.size());
    }

    private static byte[] zip(Map<String, byte[]> entries) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
                for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                    zip.putNextEntry(new ZipEntry(entry.getKey()));
                    zip.write(entry.getValue());
                    zip.closeEntry();
                }
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể tạo file Excel nhân sự.", exception);
        }
    }

    private static String text(Map<String, byte[]> entries, String path) {
        byte[] content = entries.get(path);
        if (content == null) {
            throw new IllegalStateException("File template Excel thiếu part " + path + ".");
        }
        return new String(content, StandardCharsets.UTF_8);
    }

    private static byte[] sheetBytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static LocalDate periodStart(int year, int month) {
        requireYear(year);
        if (month < 1 || month > 12) {
            throw HrApiException.badRequest("HR_EXPORT_MONTH_INVALID", "Tháng export phải nằm trong khoảng 1-12.");
        }
        return LocalDate.of(year, month, 1);
    }

    private static void requireYear(int year) {
        if (year < 2000 || year > 2100) {
            throw HrApiException.badRequest("HR_EXPORT_YEAR_INVALID", "Năm export không hợp lệ.");
        }
    }

    private static String monthSheetName(LocalDate periodStart) {
        return "T" + periodStart.getMonthValue() + "-" + String.valueOf(periodStart.getYear()).substring(2);
    }

    private static String catalogName(HrCatalogEntity value) {
        return value == null ? "" : textValue(value.getName());
    }

    @SafeVarargs
    private static <T> T firstCatalog(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static LocalDate firstDate(LocalDate first, LocalDate second) {
        return first != null ? first : second;
    }

    private static CellValue text(String value) {
        return CellValue.text(value);
    }

    private static String textValue(String value) {
        return value == null ? "" : value;
    }

    private static CellValue number(Integer value) {
        return value == null ? CellValue.blank() : CellValue.number(value.toString());
    }

    private static CellValue number(int value) {
        return CellValue.number(Integer.toString(value));
    }

    private static CellValue decimal(BigDecimal value) {
        return value == null ? CellValue.blank() : CellValue.number(value.stripTrailingZeros().toPlainString());
    }

    private static CellValue date(LocalDate value) {
        return value == null ? CellValue.blank() : CellValue.date(Long.toString(ChronoUnit.DAYS.between(EXCEL_EPOCH, value)));
    }

    private static Integer age(LocalDate birthDate, LocalDate asOf) {
        if (birthDate == null || asOf == null || birthDate.isAfter(asOf)) {
            return null;
        }
        int age = asOf.getYear() - birthDate.getYear();
        if (birthDate.plusYears(age).isAfter(asOf)) {
            age--;
        }
        return age;
    }

    private static String tenureLabel(LocalDate startDate, LocalDate asOf) {
        if (startDate == null || asOf == null || startDate.isAfter(asOf)) {
            return "";
        }
        int years = 0;
        LocalDate cursor = startDate;
        while (!cursor.plusYears(1).isAfter(asOf)) {
            cursor = cursor.plusYears(1);
            years++;
        }
        int months = 0;
        while (!cursor.plusMonths(1).isAfter(asOf)) {
            cursor = cursor.plusMonths(1);
            months++;
        }
        long days = ChronoUnit.DAYS.between(cursor, asOf) + 1;
        return years + " NĂM " + months + " THÁNG " + days + " NGÀY ";
    }

    private static String genderLabel(HrEmployeeGender gender) {
        if (gender == HrEmployeeGender.MALE) {
            return "Nam";
        }
        if (gender == HrEmployeeGender.FEMALE) {
            return "Nữ";
        }
        return "";
    }

    private static String columnName(int index) {
        StringBuilder name = new StringBuilder();
        int value = index;
        while (value > 0) {
            value--;
            name.insert(0, (char) ('A' + (value % 26)));
            value /= 26;
        }
        return name.toString();
    }

    private static String escape(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private static String escapeAttribute(String value) {
        return escape(value).replace("\"", "&quot;");
    }

    public record ExportFile(String fileName, byte[] content) {
    }

    private record SheetPlan(String name, String path) {
    }

    private record RowTemplate(String rowAttributes, Map<String, String> styles, int columnCount, int originalDataRows) {
    }

    private enum CellType {
        TEXT,
        NUMBER,
        DATE
    }

    private record CellValue(CellType type, String value) {
        static CellValue blank() {
            return new CellValue(CellType.TEXT, "");
        }

        static CellValue text(String value) {
            return new CellValue(CellType.TEXT, value == null ? "" : value);
        }

        static CellValue number(String value) {
            return new CellValue(CellType.NUMBER, value == null ? "" : value);
        }

        static CellValue date(String value) {
            return new CellValue(CellType.DATE, value == null ? "" : value);
        }

        boolean isBlank() {
            return value == null || value.isBlank();
        }
    }
}

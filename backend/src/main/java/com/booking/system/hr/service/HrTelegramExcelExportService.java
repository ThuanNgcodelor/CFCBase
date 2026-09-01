package com.booking.system.hr.service;

import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrTelegramRegistration;
import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import com.booking.system.hr.repository.HrTelegramRegistrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class HrTelegramExcelExportService {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final HrTelegramRegistrationRepository registrationRepository;

    public ExportFile export(HrTelegramRegistrationStatus status) {
        List<HrTelegramRegistration> registrations = registrationRepository
                .search(status, null, PageRequest.of(0, 10000, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent();
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("MaNV", "HoTen", "SoDienThoai", "TelegramUserId", "TelegramChatId",
                "TelegramUsername", "TrangThai", "NgayDangKy", "NgayXacMinh", "GhiChu"));
        for (HrTelegramRegistration registration : registrations) {
            HrEmployee employee = registration.getEmployee();
            rows.add(List.of(
                    value(employee == null ? registration.getEnteredEmployeeCode() : employee.getEmployeeCode()),
                    value(employee == null ? null : employee.getFullName()),
                    value(registration.getPhoneNumber()),
                    value(registration.getTelegramUserId()),
                    value(registration.getTelegramChatId()),
                    value(registration.getTelegramUsername()),
                    registration.getStatus() == null ? "" : registration.getStatus().name(),
                    registration.getCreatedAt() == null ? "" : DATE_TIME.format(registration.getCreatedAt()),
                    registration.getReviewedAt() == null ? "" : DATE_TIME.format(registration.getReviewedAt()),
                    value(registration.getReviewNote())
            ));
        }
        return new ExportFile("telegram-nhan-vien.xlsx", xlsx(rows));
    }

    private static byte[] xlsx(List<List<String>> rows) {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                </Types>
                """);
        entries.put("_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);
        entries.put("xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets><sheet name="TelegramNhanVien" sheetId="1" r:id="rId1"/></sheets>
                </workbook>
                """);
        entries.put("xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                </Relationships>
                """);
        StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            sheet.append("<row r=\"").append(rowIndex + 1).append("\">");
            List<String> row = rows.get(rowIndex);
            for (int column = 0; column < row.size(); column++) {
                String value = row.get(column) == null ? "" : row.get(column);
                sheet.append("<c r=\"").append(columnName(column)).append(rowIndex + 1).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                        .append(xml(value)).append("</t></is></c>");
            }
            sheet.append("</row>");
        }
        sheet.append("</sheetData></worksheet>");
        entries.put("xl/worksheets/sheet1.xml", sheet.toString());
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
                for (Map.Entry<String, String> entry : entries.entrySet()) {
                    zip.putNextEntry(new ZipEntry(entry.getKey()));
                    zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                    zip.closeEntry();
                }
            }
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tạo file Excel Telegram.", exception);
        }
    }

    private static String value(Object value) { return value == null ? "" : String.valueOf(value); }

    private static String columnName(int zeroBased) {
        StringBuilder result = new StringBuilder();
        int value = zeroBased + 1;
        while (value > 0) {
            int remainder = (value - 1) % 26;
            result.insert(0, (char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return result.toString();
    }

    private static String xml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    public record ExportFile(String fileName, byte[] content) {}
}

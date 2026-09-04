package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrAttendanceDtos;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.entity.HrAttendanceImport;
import com.booking.system.hr.entity.HrAttendanceRecord;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrSystemSetting;
import com.booking.system.hr.enums.HrAttendanceImportStatus;
import com.booking.system.hr.enums.HrAttendanceRecordStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrAttendanceImportRepository;
import com.booking.system.hr.repository.HrAttendanceRecordRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrSystemSettingRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.HashMap;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatterBuilder;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class HrAttendanceService {
    private static final int MAX_FILE_BYTES = 15 * 1024 * 1024;
    private static final String CATEGORY = "ATTENDANCE";
    private static final Pattern MONTH_PATTERN = Pattern.compile("^(0[1-9]|1[0-2])/\\d{4}$");
    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("d/M/uuuu"), DateTimeFormatter.ofPattern("d/M/uu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"), DateTimeFormatter.ofPattern("d-M-uu"),
            DateTimeFormatter.ofPattern("uuuu/M/d"), DateTimeFormatter.ISO_LOCAL_DATE,
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d-MMM-uu").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d-MMM-uuuu").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d MMM uu").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d MMM uuuu").toFormatter(Locale.ENGLISH)
    };
    private static final DateTimeFormatter EXPORT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd-MMM-yy", Locale.ENGLISH);
    private final HrAttendanceImportRepository importRepository;
    private final HrAttendanceRecordRepository recordRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrSystemSettingRepository settingRepository;
    /** Spring Boot 4 in this project does not expose a Jackson 2 ObjectMapper bean. */
    private final ObjectMapper objectMapper = new ObjectMapper();

    public HrAttendanceDtos.Config getConfig() {
        return new HrAttendanceDtos.Config(
                intSetting("attendance.headerRow", 2),
                stringSetting("attendance.employeeCodeColumn", "B"),
                stringSetting("attendance.employeeNameColumn", "C"),
                stringSetting("attendance.dateColumn", "E"),
                listSetting("attendance.punchColumns", List.of("G", "H", "I", "J")),
                timeSetting("attendance.checkInStart", LocalTime.of(4, 0)),
                timeSetting("attendance.checkInEnd", LocalTime.of(9, 0)),
                timeSetting("attendance.checkOutStart", LocalTime.of(15, 0)),
                timeSetting("attendance.checkOutEnd", LocalTime.of(20, 0)),
                optionalTimeSetting("attendance.defaultCheckIn"),
                optionalTimeSetting("attendance.defaultCheckOut"),
                timeSetting("attendance.standardCheckIn", LocalTime.of(7, 30)),
                timeSetting("attendance.standardCheckOut", LocalTime.of(16, 30)),
                intSetting("attendance.graceMinutes", 10),
                listSetting("attendance.excludedEmployeeCodes", List.of())
        );
    }

    @Transactional
    public HrAttendanceDtos.Config updateConfig(HrAttendanceDtos.Config request, HrImportActor actor) {
        validateConfig(request);
        put("attendance.headerRow", String.valueOf(request.headerRow()), actor, "Dòng tiêu đề Excel (đánh số từ 1)");
        put("attendance.employeeCodeColumn", request.employeeCodeColumn().trim().toUpperCase(Locale.ROOT), actor, "Cột mã nhân viên");
        put("attendance.employeeNameColumn", request.employeeNameColumn().trim().toUpperCase(Locale.ROOT), actor, "Cột họ tên");
        put("attendance.dateColumn", request.dateColumn().trim().toUpperCase(Locale.ROOT), actor, "Cột ngày chấm công");
        put("attendance.punchColumns", String.join(",", request.punchColumns()), actor, "Các cột giờ chấm công");
        put("attendance.checkInStart", formatOptional(request.checkInStart()), actor, "Bắt đầu khung Check in");
        put("attendance.checkInEnd", formatOptional(request.checkInEnd()), actor, "Kết thúc khung Check in");
        put("attendance.checkOutStart", formatOptional(request.checkOutStart()), actor, "Bắt đầu khung Check out");
        put("attendance.checkOutEnd", formatOptional(request.checkOutEnd()), actor, "Kết thúc khung Check out");
        put("attendance.defaultCheckIn", formatOptional(request.defaultCheckIn()), actor, "Giờ mặc định nếu thiếu Check in");
        put("attendance.defaultCheckOut", formatOptional(request.defaultCheckOut()), actor, "Giờ mặc định nếu thiếu Check out");
        put("attendance.standardCheckIn", formatOptional(request.standardCheckIn()), actor, "Giờ chuẩn tính đi trễ");
        put("attendance.standardCheckOut", formatOptional(request.standardCheckOut()), actor, "Giờ chuẩn tính về sớm");
        put("attendance.graceMinutes", String.valueOf(request.graceMinutes()), actor, "Số phút miễn trừ");
        put("attendance.excludedEmployeeCodes", String.join(",", normalizeCodes(request.excludedEmployeeCodes())), actor, "Mã nhân viên miễn chấm công");
        return getConfig();
    }

    @Transactional
    public HrAttendanceDtos.ImportResponse upload(String fileName, byte[] bytes, HrImportActor actor) {
        return upload(fileName, bytes, actor, null);
    }

    @Transactional
    public HrAttendanceDtos.BatchImportResponse uploadBatch(List<BatchFile> files, HrImportActor actor, String requestedMonth) {
        if (files == null || files.isEmpty()) {
            throw HrApiException.badRequest("ATTENDANCE_FILES_EMPTY", "Vui lòng chọn ít nhất một file Excel chấm công.");
        }
        List<HrAttendanceDtos.ImportResponse> imports = new ArrayList<>();
        int totalRows = 0, validRows = 0, excludedRows = 0, errorRows = 0;
        for (BatchFile file : files) {
            HrAttendanceDtos.ImportResponse item = upload(file.fileName(), file.bytes(), actor, requestedMonth);
            imports.add(item);
            totalRows += item.totalRows(); validRows += item.validRows();
            excludedRows += item.excludedRows(); errorRows += item.errorRows();
        }
        return new HrAttendanceDtos.BatchImportResponse(imports, imports.size(), totalRows, validRows, excludedRows, errorRows);
    }

    public record BatchFile(String fileName, byte[] bytes) {}

    @Transactional
    public HrAttendanceDtos.ImportResponse upload(String fileName, byte[] bytes, HrImportActor actor, String requestedMonth) {
        if (bytes == null || bytes.length == 0) throw HrApiException.badRequest("ATTENDANCE_FILE_EMPTY", "Vui lòng chọn file Excel chấm công.");
        if (bytes.length > MAX_FILE_BYTES) throw HrApiException.badRequest("ATTENDANCE_FILE_TOO_LARGE", "File chấm công không được vượt quá 15 MB.");
        String hash = sha256(bytes);
        Optional<HrAttendanceImport> duplicate = importRepository.findByFileSha256(hash);
        if (duplicate.isPresent()) return toImportResponse(duplicate.get());
        String targetMonth = normalizeMonth(requestedMonth);
        HrAttendanceDtos.Config config = getConfig();
        HrAttendanceImport batch = new HrAttendanceImport();
        batch.setSourceFileName(fileName == null || fileName.isBlank() ? "attendance.xlsx" : fileName);
        batch.setFileSha256(hash); batch.setFileSize(bytes.length); batch.setHeaderRow(config.headerRow());
        batch.setConfigurationJson(writeConfigJson(config)); batch.setStatus(HrAttendanceImportStatus.PREVIEWED);
        batch.setCreatedByActor(actor.subject()); batch.setUpdatedByActor(actor.subject());
        int total = 0, valid = 0, errors = 0, excluded = 0; String month = null; Set<String> months = new java.util.HashSet<>(); String sheetName = "";
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheetAt(0); sheetName = sheet.getSheetName();
            DataFormatter formatter = new DataFormatter(Locale.US);
            List<HrAttendanceRecord> records = new ArrayList<>();
            for (int index = config.headerRow(); index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index); if (isBlank(row, config, formatter)) continue;
                total++;
                HrAttendanceRecord record = parseRow(row, index + 1, config, formatter, actor);
                if (record.getWorkDate() != null) {
                    String rowMonth = String.format("%02d/%04d", record.getWorkDate().getMonthValue(), record.getWorkDate().getYear());
                    months.add(rowMonth);
                    if (month == null) month = rowMonth;
                }
                // A row with a valid employee/date is still a usable attendance
                // row even when it has no punches (weekend/leave). Keep it in
                // the preview/export instead of treating it as an error.
                if (record.getStatus() == HrAttendanceRecordStatus.EXCLUDED) excluded++;
                else if (record.getStatus() == HrAttendanceRecordStatus.EMPLOYEE_NOT_FOUND
                        || record.getStatus() == HrAttendanceRecordStatus.DATE_INVALID
                        || record.getStatus() == HrAttendanceRecordStatus.ROW_INVALID) errors++;
                else valid++;
                records.add(record);
            }
            if (total == 0) throw HrApiException.badRequest("ATTENDANCE_NO_ROWS", "Không tìm thấy dòng chấm công hợp lệ sau dòng tiêu đề.");
            if (targetMonth != null && (!months.isEmpty() && (months.size() != 1 || !months.contains(targetMonth)))) {
                throw HrApiException.badRequest("ATTENDANCE_MONTH_MISMATCH", "File có ngày không thuộc tháng đã chọn (" + targetMonth + ").");
            }
            if (months.size() > 1) month = null;
            batch.setSourceSheetName(sheetName); batch.setAttendanceMonth(month); batch.setTotalRows(total); batch.setValidRows(valid); batch.setErrorRows(errors); batch.setExcludedRows(excluded);
            batch = importRepository.save(batch);
            for (HrAttendanceRecord record : records) { record.setImportId(batch.getId()); recordRepository.save(record); }
            return toImportResponse(batch);
        } catch (HrApiException ex) { throw ex; }
        catch (Exception ex) { throw HrApiException.badRequest("ATTENDANCE_XLSX_INVALID", "Không thể đọc file Excel chấm công. Hãy kiểm tra định dạng file."); }
    }

    public HrPageResponse<HrAttendanceDtos.ImportResponse> imports(int page, int size, String month) {
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50), Sort.by(Sort.Direction.DESC, "createdAt"));
        String normalizedMonth = normalizeMonth(month);
        var result = normalizedMonth == null
                ? importRepository.findAllByOrderByCreatedAtDesc(pageable)
                : importRepository.findAllByAttendanceMonthOrderByCreatedAtDesc(normalizedMonth, pageable);
        return HrPageResponse.from(result, this::toImportResponse);
    }

    private String normalizeMonth(String value) {
        if (value == null || value.isBlank()) return null;
        String raw = value.trim();
        if (raw.matches("^\\d{4}-\\d{2}$")) {
            raw = raw.substring(5) + "/" + raw.substring(0, 4);
        }
        if (!MONTH_PATTERN.matcher(raw).matches()) {
            throw HrApiException.badRequest("ATTENDANCE_MONTH_INVALID", "Tháng phải có định dạng MM/YYYY hoặc YYYY-MM.");
        }
        return raw;
    }

    public HrAttendanceDtos.PreviewResponse preview(String importId, int page, int size) {
        HrAttendanceImport batch = importRepository.findById(importId).orElseThrow(() -> HrApiException.notFound("ATTENDANCE_IMPORT_NOT_FOUND", "Không tìm thấy lần import chấm công."));
        return new HrAttendanceDtos.PreviewResponse(toImportResponse(batch), HrPageResponse.from(recordRepository.findByImportIdOrderBySourceRowNumber(importId, PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100))), this::toRecordResponse));
    }

    @Transactional
    public void deleteImport(String importId, HrImportActor actor) {
        HrAttendanceImport batch = importRepository.findById(importId)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_IMPORT_NOT_FOUND", "Không tìm thấy lần import chấm công."));
        importRepository.deleteById(batch.getId());
    }

    @Transactional(readOnly = true)
    public ExportFile export(String importId) {
        HrAttendanceImport batch = importRepository.findById(importId)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_IMPORT_NOT_FOUND", "Không tìm thấy lần import chấm công."));
        // Do not drop rows with no punches. They represent weekends, leave or
        // a day the machine did not receive a punch and must remain visible in
        // the normalized monthly file.
        List<HrAttendanceRecord> records = recordRepository.findByImportIdOrderBySourceRowNumber(importId);
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Chấm công");
            CellStyle title = workbook.createCellStyle(); title.setAlignment(HorizontalAlignment.CENTER);
            title.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex()); title.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle header = workbook.createCellStyle(); header.setAlignment(HorizontalAlignment.CENTER); header.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex()); header.setFillPattern(FillPatternType.SOLID_FOREGROUND); header.setBorderBottom(BorderStyle.THIN);
            Row titleRow = sheet.createRow(0); titleRow.createCell(0).setCellValue("GIỜ CHẤM CÔNG" + (batch.getAttendanceMonth() == null ? "" : " - " + batch.getAttendanceMonth())); titleRow.getCell(0).setCellStyle(title); sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 7));
            Row headerRow = sheet.createRow(1); String[] headers = {"STT", "Mã nhân viên", "Tên nhân viên", "Phòng ban", "Ngày", "Thứ", "Lần chấm 1", "Lần chấm 2"};
            for (int i = 0; i < headers.length; i++) { headerRow.createCell(i).setCellValue(headers[i]); headerRow.getCell(i).setCellStyle(header); }
            int rowNumber = 2, serial = 1;
            for (HrAttendanceRecord record : records) {
                Row row = sheet.createRow(rowNumber++); row.createCell(0).setCellValue(serial++); row.createCell(1).setCellValue(record.getEmployeeCode() == null ? "" : record.getEmployeeCode()); row.createCell(2).setCellValue(record.getEmployeeName() == null ? "" : record.getEmployeeName()); row.createCell(3).setCellValue(""); row.createCell(4).setCellValue(record.getWorkDate() == null ? "" : record.getWorkDate().format(EXPORT_DATE_FORMAT)); row.createCell(5).setCellValue(record.getWorkDate() == null ? "" : dayName(record.getWorkDate().getDayOfWeek())); row.createCell(6).setCellValue(record.getCheckIn() == null ? "" : record.getCheckIn().toString().substring(0, 5)); row.createCell(7).setCellValue(record.getCheckOut() == null ? "" : record.getCheckOut().toString().substring(0, 5));
            }
            int[] widths = {8, 16, 28, 20, 14, 14, 14, 14}; for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);
            workbook.write(output);
            String safeName = (batch.getSourceFileName() == null ? "attendance" : batch.getSourceFileName()).replaceAll("(?i)\\.(xlsx|xls|xlsm)$", "");
            return new ExportFile(safeName + "-da-format.xlsx", output.toByteArray());
        } catch (IOException ex) { throw HrApiException.badRequest("ATTENDANCE_EXPORT_FAILED", "Không thể tạo file Excel chấm công."); }
    }

    @Transactional(readOnly = true)
    public ExportFile exportCong(String importId) {
        HrAttendanceImport batch = importRepository.findById(importId)
                .orElseThrow(() -> HrApiException.notFound("ATTENDANCE_IMPORT_NOT_FOUND", "Không tìm thấy lần import chấm công."));
        List<HrAttendanceRecord> source = recordRepository.findByImportIdOrderBySourceRowNumber(importId).stream()
                .filter(record -> record.getWorkDate() != null && record.getEmployeeCode() != null && !record.getEmployeeCode().isBlank())
                .toList();
        List<LocalDate> dates = source.stream().map(HrAttendanceRecord::getWorkDate).distinct().sorted().toList();
        Map<String, HrAttendanceRecord> lookup = new HashMap<>();
        Map<String, String> names = new LinkedHashMap<>();
        for (HrAttendanceRecord record : source) {
            String key = record.getEmployeeCode() + "|" + record.getWorkDate();
            lookup.put(key, record); names.putIfAbsent(record.getEmployeeCode(), record.getEmployeeName() == null ? "" : record.getEmployeeName());
        }
        List<String> employeeCodes = new ArrayList<>(names.keySet());
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Công");
            CellStyle title = workbook.createCellStyle(); title.setAlignment(HorizontalAlignment.CENTER); title.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex()); title.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle header = workbook.createCellStyle(); header.setAlignment(HorizontalAlignment.CENTER); header.setFillForegroundColor(IndexedColors.LIGHT_GREEN.getIndex()); header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Row titleRow = sheet.createRow(0); titleRow.createCell(0).setCellValue("BẢNG CÔNG" + (batch.getAttendanceMonth() == null ? "" : " - " + batch.getAttendanceMonth())); titleRow.getCell(0).setCellStyle(title); sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, dates.size() + 3));
            Row headerRow = sheet.createRow(1); String[] fixed = {"STT", "Mã nhân viên", "Tên nhân viên"};
            for (int i = 0; i < fixed.length; i++) { headerRow.createCell(i).setCellValue(fixed[i]); headerRow.getCell(i).setCellStyle(header); }
            for (int i = 0; i < dates.size(); i++) { headerRow.createCell(i + 3).setCellValue(dates.get(i).format(EXPORT_DATE_FORMAT)); headerRow.getCell(i + 3).setCellStyle(header); }
            headerRow.createCell(dates.size() + 3).setCellValue("Tổng ngày công"); headerRow.getCell(dates.size() + 3).setCellStyle(header);
            int rowNumber = 2, serial = 1;
            for (String code : employeeCodes) {
                Row row = sheet.createRow(rowNumber++); row.createCell(0).setCellValue(serial++); row.createCell(1).setCellValue(code); row.createCell(2).setCellValue(names.get(code)); double total = 0;
                for (int i = 0; i < dates.size(); i++) { HrAttendanceRecord record = lookup.get(code + "|" + dates.get(i)); double value = attendanceValue(record); row.createCell(i + 3).setCellValue(value); total += value; }
                row.createCell(dates.size() + 3).setCellValue(total);
            }
            for (int i = 0; i < dates.size() + 4; i++) sheet.setColumnWidth(i, (i == 2 ? 28 : 14) * 256);
            workbook.write(output);
            String safeName = (batch.getSourceFileName() == null ? "attendance" : batch.getSourceFileName()).replaceAll("(?i)\\.(xlsx|xls|xlsm)$", "");
            return new ExportFile("CONG_" + safeName + ".xlsx", output.toByteArray());
        } catch (IOException ex) { throw HrApiException.badRequest("ATTENDANCE_EXPORT_FAILED", "Không thể tạo file Bảng Công."); }
    }

    private static double attendanceValue(HrAttendanceRecord record) {
        if (record == null || record.getStatus() == HrAttendanceRecordStatus.EXCLUDED || record.getStatus() == HrAttendanceRecordStatus.NO_PUNCH) return 0;
        if (record.getStatus() == HrAttendanceRecordStatus.MISSING_CHECK_IN || record.getStatus() == HrAttendanceRecordStatus.MISSING_CHECK_OUT) return 0.5;
        return record.getWorkValue() == null ? 0 : record.getWorkValue().doubleValue();
    }

    public record ExportFile(String fileName, byte[] content) {}

    private static String dayName(DayOfWeek day) { return day.getDisplayName(java.time.format.TextStyle.FULL, Locale.forLanguageTag("vi-VN")); }

    private HrAttendanceRecord parseRow(Row row, int sourceRow, HrAttendanceDtos.Config config, DataFormatter formatter, HrImportActor actor) {
        HrAttendanceRecord result = new HrAttendanceRecord(); result.setSourceRowNumber(sourceRow); result.setStatus(HrAttendanceRecordStatus.VALID); result.setWorkValue(BigDecimal.ZERO); result.setCreatedByActor(actor.subject()); result.setUpdatedByActor(actor.subject());
        String code = value(row, config.employeeCodeColumn(), formatter).trim().toUpperCase(Locale.ROOT);
        String name = value(row, config.employeeNameColumn(), formatter).trim(); result.setEmployeeCode(code); result.setEmployeeName(name);
        if (code.isBlank() || name.isBlank()) { result.setStatus(HrAttendanceRecordStatus.ROW_INVALID); result.setErrorMessage("Thiếu mã nhân viên hoặc họ tên."); return result; }
        HrEmployee employee = employeeRepository.findByEmployeeCode(code).orElse(null);
        if (employee == null) { result.setStatus(HrAttendanceRecordStatus.EMPLOYEE_NOT_FOUND); result.setErrorMessage("Không tìm thấy mã nhân viên trong CFCBase."); }
        LocalDate date = parseDate(row.getCell(columnNumber(config.dateColumn())), formatter); result.setWorkDate(date);
        if (date == null) { result.setStatus(HrAttendanceRecordStatus.DATE_INVALID); result.setErrorMessage("Ngày chấm công không hợp lệ."); }
        if (employee != null) result.setEmployeeId(employee.getId());
        List<String> excludedCodes = normalizeCodes(config.excludedEmployeeCodes());
        if (excludedCodes.stream().anyMatch(code::equals)) {
            result.setStatus(HrAttendanceRecordStatus.EXCLUDED); result.setErrorMessage("Mã nhân viên được cấu hình miễn chấm công."); result.setWorkValue(BigDecimal.ZERO); return result;
        }
        List<String> punches = config.punchColumns().stream().map(column -> value(row, column, formatter)).map(String::trim).filter(value -> !value.isBlank()).toList();
        result.setPunchesJson(writeJson(punches));
        List<LocalTime> times = punches.stream().map(this::parseTime).filter(Optional::isPresent).map(Optional::get).sorted().toList();
        LocalTime actualCheckIn = times.stream().filter(time -> inRange(time, config.checkInStart(), config.checkInEnd())).findFirst().orElse(null);
        LocalTime actualCheckOut = times.stream().filter(time -> inRange(time, config.checkOutStart(), config.checkOutEnd())).reduce((first, second) -> second).orElse(null);
        // Match the Apps Script workflow: if one side is missing, fill it with
        // the configured default (07:30 / 17:00 when the optional fields are blank).
        LocalTime defaultCheckIn = config.defaultCheckIn() == null
                ? (config.standardCheckIn() == null ? LocalTime.of(7, 30) : config.standardCheckIn())
                : config.defaultCheckIn();
        LocalTime defaultCheckOut = config.defaultCheckOut() == null
                ? (config.standardCheckOut() == null ? LocalTime.of(16, 30) : config.standardCheckOut())
                : config.defaultCheckOut();
        LocalTime checkIn = actualCheckIn;
        LocalTime checkOut = actualCheckOut;
        boolean autoFilled = false;
        if (checkIn == null && checkOut != null) { checkIn = defaultCheckIn; autoFilled = true; }
        if (checkIn != null && checkOut == null) { checkOut = defaultCheckOut; autoFilled = true; }
        result.setCheckIn(checkIn); result.setCheckOut(checkOut);
        if (date != null && employee != null && autoFilled) {
            String filled = actualCheckIn == null ? "Check in" : "Check out";
            LocalTime filledTime = actualCheckIn == null ? checkIn : checkOut;
            result.setStatus(HrAttendanceRecordStatus.AUTO_FILLED); result.setErrorMessage(filled + " được tự điền mặc định " + filledTime.toString().substring(0, 5) + ".");
        } else if (date != null && employee != null && actualCheckIn == null && actualCheckOut == null) {
            result.setStatus(HrAttendanceRecordStatus.NO_PUNCH); result.setErrorMessage("Không có giờ chấm; giữ nguyên dòng (có thể là ngày nghỉ hoặc không làm việc).");
        } else if (date != null && employee != null && checkIn == null) {
            result.setStatus(HrAttendanceRecordStatus.MISSING_CHECK_IN); result.setErrorMessage("Thiếu Check in và không thể tự điền.");
        } else if (date != null && employee != null && checkOut == null) {
            result.setStatus(HrAttendanceRecordStatus.MISSING_CHECK_OUT); result.setErrorMessage("Thiếu Check out và không thể tự điền.");
        }
        if (checkIn != null && checkOut != null) { result.setWorkValue(BigDecimal.ONE); result.setLateMinutes(Math.max(0, minutesBetween(config.standardCheckIn(), checkIn) - config.graceMinutes())); result.setEarlyMinutes(Math.max(0, minutesBetween(checkOut, config.standardCheckOut()) - config.graceMinutes())); }
        return result;
    }

    private boolean isBlank(Row row, HrAttendanceDtos.Config config, DataFormatter formatter) { if (row == null) return true; return value(row, config.employeeCodeColumn(), formatter).isBlank() && value(row, config.employeeNameColumn(), formatter).isBlank() && value(row, config.dateColumn(), formatter).isBlank(); }
    private String value(Row row, String column, DataFormatter formatter) { Cell cell = row.getCell(columnNumber(column)); return cell == null ? "" : formatter.formatCellValue(cell); }
    private static int columnNumber(String letters) { String normalized = letters.trim().toUpperCase(Locale.ROOT); int result = 0; for (char c : normalized.toCharArray()) { if (c < 'A' || c > 'Z') throw HrApiException.badRequest("ATTENDANCE_COLUMN_INVALID", "Tên cột Excel không hợp lệ: " + letters); result = result * 26 + c - 'A' + 1; } return result - 1; }
    private LocalDate parseDate(Cell cell, DataFormatter formatter) {
        if (cell == null) return null;
        if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC) {
            if (DateUtil.isValidExcelDate(cell.getNumericCellValue())) {
                try { return DateUtil.getLocalDateTime(cell.getNumericCellValue()).toLocalDate(); } catch (Exception ignored) { }
            }
        }
        String raw = formatter.formatCellValue(cell).trim();
        if (raw.isBlank()) return null;
        for (DateTimeFormatter format : DATE_FORMATS) {
            try { return LocalDate.parse(raw, format); } catch (DateTimeParseException ignored) { }
        }
        return null;
    }
    private Optional<LocalTime> parseTime(String raw) { try { if (raw.matches("\\d{1,2}:\\d{2}(:\\d{2})?")) return Optional.of(LocalTime.parse(raw.length() == 5 ? raw : raw.substring(0, 8))); double value = Double.parseDouble(raw); if (value >= 0 && value < 1) return Optional.of(LocalTime.ofSecondOfDay(Math.round(value * 86400))); } catch (Exception ignored) {} return Optional.empty(); }
    private static boolean inRange(LocalTime value, LocalTime start, LocalTime end) { return value != null && !value.isBefore(start) && !value.isAfter(end); }
    private static int minutesBetween(LocalTime start, LocalTime end) { return (int) Math.max(0, java.time.Duration.between(start, end).toMinutes()); }

    private HrAttendanceDtos.ImportResponse toImportResponse(HrAttendanceImport item) { int excludedRows = item.getExcludedRows(); if (item.getId() != null) excludedRows = (int) recordRepository.countByImportIdAndStatus(item.getId(), HrAttendanceRecordStatus.EXCLUDED); return new HrAttendanceDtos.ImportResponse(item.getId(), item.getSourceFileName(), item.getSourceSheetName(), item.getAttendanceMonth(), item.getStatus(), readConfig(item.getConfigurationJson()), item.getTotalRows(), item.getValidRows(), item.getErrorRows(), excludedRows, item.getLastError(), item.getCreatedAt()); }
    private HrAttendanceDtos.RecordResponse toRecordResponse(HrAttendanceRecord item) { return new HrAttendanceDtos.RecordResponse(item.getId(), item.getSourceRowNumber(), item.getEmployeeCode(), item.getEmployeeName(), item.getWorkDate(), readList(item.getPunchesJson()), item.getCheckIn(), item.getCheckOut(), item.getWorkValue(), item.getLateMinutes(), item.getEarlyMinutes(), item.getStatus(), item.getErrorMessage()); }
    private HrAttendanceDtos.Config readConfig(String value) {
        try {
            JsonNode node = objectMapper.readTree(value);
            return new HrAttendanceDtos.Config(
                    node.path("headerRow").asInt(2), node.path("employeeCodeColumn").asText("B"),
                    node.path("employeeNameColumn").asText("C"), node.path("dateColumn").asText("E"),
                    readList(node.path("punchColumns").toString()), parseJsonTime(node, "checkInStart", LocalTime.of(4, 0)),
                    parseJsonTime(node, "checkInEnd", LocalTime.of(9, 0)), parseJsonTime(node, "checkOutStart", LocalTime.of(15, 0)),
                    parseJsonTime(node, "checkOutEnd", LocalTime.of(20, 0)), parseJsonTime(node, "defaultCheckIn", null),
                    parseJsonTime(node, "defaultCheckOut", null), parseJsonTime(node, "standardCheckIn", LocalTime.of(7, 30)),
                    parseJsonTime(node, "standardCheckOut", LocalTime.of(16, 30)), node.path("graceMinutes").asInt(10), readList(node.path("excludedEmployeeCodes").toString()));
        } catch (Exception ex) { return getConfig(); }
    }
    private LocalTime parseJsonTime(JsonNode node, String field, LocalTime fallback) { String value = node.path(field).asText(""); try { return value.isBlank() ? fallback : LocalTime.parse(value); } catch (Exception ex) { return fallback; } }
    private String writeConfigJson(HrAttendanceDtos.Config config) {
        Map<String, Object> snapshot = new LinkedHashMap<>(); snapshot.put("headerRow", config.headerRow()); snapshot.put("employeeCodeColumn", config.employeeCodeColumn()); snapshot.put("employeeNameColumn", config.employeeNameColumn()); snapshot.put("dateColumn", config.dateColumn()); snapshot.put("punchColumns", config.punchColumns()); snapshot.put("checkInStart", formatOptional(config.checkInStart())); snapshot.put("checkInEnd", formatOptional(config.checkInEnd())); snapshot.put("checkOutStart", formatOptional(config.checkOutStart())); snapshot.put("checkOutEnd", formatOptional(config.checkOutEnd())); snapshot.put("defaultCheckIn", formatOptional(config.defaultCheckIn())); snapshot.put("defaultCheckOut", formatOptional(config.defaultCheckOut())); snapshot.put("standardCheckIn", formatOptional(config.standardCheckIn())); snapshot.put("standardCheckOut", formatOptional(config.standardCheckOut())); snapshot.put("graceMinutes", config.graceMinutes()); snapshot.put("excludedEmployeeCodes", normalizeCodes(config.excludedEmployeeCodes())); return writeJson(snapshot);
    }
    private List<String> readList(String value) { try { return value == null ? List.of() : objectMapper.readValue(value, objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)); } catch (Exception ex) { return List.of(); } }
    private String writeJson(Object value) { try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException ex) { throw new IllegalStateException(ex); } }
    private String sha256(byte[] bytes) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private void validateConfig(HrAttendanceDtos.Config config) { if (config == null || config.punchColumns() == null || config.punchColumns().isEmpty()) throw HrApiException.badRequest("ATTENDANCE_CONFIG_INVALID", "Cần cấu hình ít nhất một cột giờ chấm công."); if (config.checkInStart() == null || config.checkInEnd() == null || config.checkOutStart() == null || config.checkOutEnd() == null || config.standardCheckIn() == null || config.standardCheckOut() == null) throw HrApiException.badRequest("ATTENDANCE_CONFIG_INVALID", "Các mốc giờ bắt buộc không được để trống."); for (String column : List.of(config.employeeCodeColumn(), config.employeeNameColumn(), config.dateColumn())) columnNumber(column); config.punchColumns().forEach(HrAttendanceService::columnNumber); }
    private void put(String key, String value, HrImportActor actor, String description) { var setting = settingRepository.findBySettingKey(key).orElseGet(HrSystemSetting::new); setting.setSettingKey(key); setting.setSettingValue(value); setting.setCategory(CATEGORY); setting.setDescription(description); setting.setCreatedByActor(setting.getCreatedByActor() == null ? actor.subject() : setting.getCreatedByActor()); setting.setUpdatedByActor(actor.subject()); settingRepository.save(setting); }
    private String stringSetting(String key, String fallback) { return settingRepository.findBySettingKey(key).map(s -> s.getSettingValue()).filter(v -> v != null && !v.isBlank()).orElse(fallback); }
    private int intSetting(String key, int fallback) { try { return Integer.parseInt(stringSetting(key, String.valueOf(fallback))); } catch (Exception ex) { return fallback; } }
    private LocalTime timeSetting(String key, LocalTime fallback) { try { return LocalTime.parse(stringSetting(key, fallback.toString())); } catch (Exception ex) { return fallback; } }
    private LocalTime optionalTimeSetting(String key) { String value = stringSetting(key, ""); try { return value.isBlank() ? null : LocalTime.parse(value); } catch (Exception ex) { return null; } }
    private List<String> listSetting(String key, List<String> fallback) { String value = stringSetting(key, ""); return value.isBlank() ? fallback : java.util.Arrays.stream(value.split(",")).map(String::trim).filter(v -> !v.isBlank()).toList(); }
    private String formatOptional(LocalTime value) { return value == null ? "" : value.toString(); }
    private List<String> normalizeCodes(List<String> values) { return values == null ? List.of() : values.stream().flatMap(value -> java.util.Arrays.stream(value.split(","))).map(value -> value.trim().toUpperCase(Locale.ROOT)).filter(value -> !value.isBlank()).distinct().toList(); }
}

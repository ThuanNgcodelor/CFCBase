package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrPayrollDtos;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeTelegramBinding;
import com.booking.system.hr.entity.HrPayrollImport;
import com.booking.system.hr.entity.HrPayrollImportRow;
import com.booking.system.hr.enums.HrPayrollImportStatus;
import com.booking.system.hr.enums.HrPayrollRowStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrEmployeeTelegramBindingRepository;
import com.booking.system.hr.repository.HrPayrollImportRepository;
import com.booking.system.hr.repository.HrPayrollImportRowRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class HrPayrollService {
    private final HrPayrollWorkbookParser parser;
    private final HrPayrollImportRepository importRepository;
    private final HrPayrollImportRowRepository rowRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeTelegramBindingRepository bindingRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public HrPayrollDtos.ImportResponse upload(String fileName, byte[] bytes, HrImportActor actor) {
        HrPayrollWorkbookParser.ParsedWorkbook parsed = parser.parse(bytes);
        if (importRepository.findByFileSha256(parsed.sha256()).isPresent()) {
            throw HrApiException.conflict("PAYROLL_FILE_DUPLICATE", "File lương này đã được tải lên trước đó.");
        }
        HrPayrollImport payrollImport = new HrPayrollImport();
        payrollImport.setSourceFileName(fileName == null || fileName.isBlank() ? "payroll.xlsx" : fileName);
        payrollImport.setFileSha256(parsed.sha256()); payrollImport.setFileSize(parsed.fileSize());
        payrollImport.setSourceSheetName(parsed.sheetName()); payrollImport.setPayrollMonth(parsed.payrollMonth());
        payrollImport.setStatus(HrPayrollImportStatus.PREVIEWED); payrollImport.setTotalRows(parsed.rows().size());
        payrollImport.setValidRows(parsed.rows().size()); payrollImport.setCreatedByActor(actor.subject()); payrollImport.setUpdatedByActor(actor.subject());
        payrollImport = importRepository.save(payrollImport);

        Map<String, HrEmployee> employees = new HashMap<>();
        employeeRepository.findAllByEmployeeCodeIn(parsed.rows().stream().map(HrPayrollWorkbookParser.PayrollRow::employeeCode).toList())
                .forEach(employee -> employees.put(employee.getEmployeeCode().toUpperCase(), employee));
        Map<String, HrEmployeeTelegramBinding> bindings = new HashMap<>();
        if (!employees.isEmpty()) bindingRepository.findAllByEmployeeIdIn(employees.values().stream().map(HrEmployee::getId).toList())
                .forEach(binding -> bindings.put(binding.getEmployee().getId(), binding));
        int ready = 0, skipped = 0;
        for (HrPayrollWorkbookParser.PayrollRow value : parsed.rows()) {
            HrEmployee employee = employees.get(value.employeeCode());
            HrEmployeeTelegramBinding binding = employee == null ? null : bindings.get(employee.getId());
            HrPayrollImportRow row = new HrPayrollImportRow();
            row.setPayrollImport(payrollImport); row.setSourceRowNumber(value.rowNumber()); row.setEmployee(employee);
            row.setEmployeeCode(value.employeeCode()); row.setEmployeeName(value.employeeName()); row.setStatus(HrPayrollRowStatus.SKIPPED);
            row.setTelegramChatId(null); row.setTelegramUserId(null);
            if (employee == null) row.setErrorMessage("Không tìm thấy Mã nhân viên trong CFCBase.");
            else if (binding == null || binding.getStatus() != com.booking.system.hr.enums.HrTelegramBindingStatus.ACTIVE || binding.getTelegramChatId() == null) row.setErrorMessage("Chưa xác minh Telegram.");
            else { row.setStatus(HrPayrollRowStatus.READY); row.setTelegramChatId(binding.getTelegramChatId()); row.setTelegramUserId(binding.getTelegramUserId()); ready++; }
            if (row.getStatus() == HrPayrollRowStatus.SKIPPED) skipped++;
            try { row.setPayloadJson(objectMapper.writeValueAsString(value.values())); }
            catch (JsonProcessingException exception) { throw new IllegalStateException("Không lưu được dữ liệu lương.", exception); }
            row.setCreatedByActor(actor.subject()); row.setUpdatedByActor(actor.subject()); rowRepository.save(row);
        }
        payrollImport.setReadyRows(ready); payrollImport.setSkippedRows(skipped); payrollImport.setUpdatedByActor(actor.subject());
        return toImportResponse(importRepository.save(payrollImport));
    }

    @Transactional(readOnly = true)
    public HrPayrollDtos.PreviewResponse preview(String importId, int page, int size,
                                                  HrPayrollRowStatus status, String keyword) {
        HrPayrollImport payrollImport = requireImport(importId);
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        var rows = rowRepository.search(importId, status, normalizedKeyword,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100)));
        return new HrPayrollDtos.PreviewResponse(toImportResponse(payrollImport), HrPageResponse.from(rows, this::toRowResponse));
    }

    @Transactional
    public HrPayrollDtos.ImportResponse refreshEligibility(String importId, HrImportActor actor) {
        HrPayrollImport payrollImport = requireImport(importId);
        List<HrPayrollImportRow> rows = rowRepository.findByPayrollImportIdOrderBySourceRowNumber(importId);
        Map<String, HrEmployee> employees = new HashMap<>();
        employeeRepository.findAllByEmployeeCodeIn(rows.stream().map(HrPayrollImportRow::getEmployeeCode).toList())
                .forEach(employee -> employees.put(employee.getEmployeeCode().toUpperCase(), employee));
        Map<String, HrEmployeeTelegramBinding> bindings = new HashMap<>();
        if (!employees.isEmpty()) {
            bindingRepository.findAllByEmployeeIdIn(employees.values().stream().map(HrEmployee::getId).toList())
                    .forEach(binding -> bindings.put(binding.getEmployee().getId(), binding));
        }
        int ready = 0;
        int skipped = 0;
        for (HrPayrollImportRow row : rows) {
            HrEmployee employee = employees.get(row.getEmployeeCode().toUpperCase());
            HrEmployeeTelegramBinding binding = employee == null ? null : bindings.get(employee.getId());
            row.setEmployee(employee);
            row.setTelegramChatId(null);
            row.setTelegramUserId(null);
            if (employee == null) {
                row.setStatus(HrPayrollRowStatus.SKIPPED);
                row.setErrorMessage("Không tìm thấy Mã nhân viên trong CFCBase.");
                skipped++;
            } else if (binding == null || binding.getStatus() != com.booking.system.hr.enums.HrTelegramBindingStatus.ACTIVE
                    || binding.getTelegramChatId() == null || binding.getTelegramUserId() == null) {
                row.setStatus(HrPayrollRowStatus.SKIPPED);
                row.setErrorMessage("Chưa xác minh Telegram.");
                skipped++;
            } else {
                row.setStatus(HrPayrollRowStatus.READY);
                row.setTelegramChatId(binding.getTelegramChatId());
                row.setTelegramUserId(binding.getTelegramUserId());
                row.setErrorMessage(null);
                ready++;
            }
            row.setUpdatedByActor(actor.subject());
            rowRepository.save(row);
        }
        payrollImport.setReadyRows(ready);
        payrollImport.setSkippedRows(skipped);
        payrollImport.setUpdatedByActor(actor.subject());
        return toImportResponse(importRepository.save(payrollImport));
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrPayrollDtos.ImportResponse> imports(int page, int size) {
        return HrPageResponse.from(importRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 50))), this::toImportResponse);
    }

    HrPayrollImport requireImport(String id) { return importRepository.findById(id).orElseThrow(() -> HrApiException.notFound("PAYROLL_IMPORT_NOT_FOUND", "Không tìm thấy lần nhập lương.")); }

    private HrPayrollDtos.ImportResponse toImportResponse(HrPayrollImport value) {
        return new HrPayrollDtos.ImportResponse(value.getId(), value.getSourceFileName(), value.getPayrollMonth(), value.getStatus(), value.getTotalRows(), value.getValidRows(), value.getReadyRows(), value.getSkippedRows(), value.getInvalidRows(), value.getLastError(), value.getCreatedAt());
    }
    private HrPayrollDtos.PayrollRowResponse toRowResponse(HrPayrollImportRow row) {
        Map<String, Object> values;
        try { values = objectMapper.readValue(row.getPayloadJson(), objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class)); }
        catch (Exception ignored) { values = Map.of(); }
        return new HrPayrollDtos.PayrollRowResponse(row.getId(), row.getSourceRowNumber(), row.getEmployeeCode(), row.getEmployeeName(), row.getStatus(), row.getErrorMessage(), values);
    }
}

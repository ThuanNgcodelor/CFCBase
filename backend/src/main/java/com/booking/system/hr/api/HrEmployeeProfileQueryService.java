package com.booking.system.hr.api;

import com.booking.system.hr.api.dto.*;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.repository.*;
import com.booking.system.hr.service.HrEmploymentContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HrEmployeeProfileQueryService {
    private final HrEmployeeRepository employees;
    private final HrEmploymentContractRepository contracts;
    private final HrEmploymentContractDocumentRepository documents;
    private final HrAuditEventRepository audit;
    private final HrEmploymentContractService contractService;
    private final HrActivityQueryService activity;

    public HrPageResponse<HrMovementResponse> movements(String employeeId, int page, int size) {
        requireEmployee(employeeId);
        return activity.employeeMovements(employeeId, page, size);
    }

    public HrPageResponse<HrAuditEventResponse> profileAudit(String employeeId, int page, int size) {
        requireEmployee(employeeId);
        return HrPageResponse.from(audit.findByEntityTypeAndEntityIdOrderByOccurredAtDesc(
                "HR_EMPLOYEE", employeeId,
                HrActivityQueryService.pageRequest(page, size, Sort.by(Sort.Order.desc("id")))),
                HrAuditEventResponse::from);
    }

    public HrPageResponse<HrApiDtos.EmploymentContractSummary> contracts(String employeeId, int page, int size) {
        requireEmployee(employeeId);
        return HrPageResponse.from(contracts.findByEmployee_Id(employeeId,
                HrActivityQueryService.pageRequest(page, size,
                        Sort.by(Sort.Order.desc("effectiveFrom"), Sort.Order.desc("createdAt"), Sort.Order.desc("id")))),
                contractService::toSummary);
    }

    public HrPageResponse<HrEmploymentContractDtos.DocumentSummary> documents(
            String employeeId, String contractId, int page, int size) {
        requireEmployee(employeeId);
        var contract = contracts.findById(contractId)
                .filter(value -> employeeId.equals(value.getEmployee().getId()))
                .orElseThrow(() -> HrApiException.notFound("EMPLOYMENT_CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng của nhân sự này."));
        return HrPageResponse.from(documents.findSummaries(contract.getId(),
                HrActivityQueryService.pageRequest(page, size,
                        Sort.by(Sort.Order.desc("generatedAt"), Sort.Order.desc("id")))), value -> value);
    }

    private void requireEmployee(String id) {
        if (!employees.existsById(id)) {
            throw HrApiException.notFound("HR_EMPLOYEE_NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
        }
    }
}

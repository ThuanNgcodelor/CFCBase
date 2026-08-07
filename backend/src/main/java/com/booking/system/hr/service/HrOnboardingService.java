package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrOnboardingDtos;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmploymentContract;
import com.booking.system.hr.enums.HrOnboardingSource;
import com.booking.system.hr.enums.HrWorkforceGroup;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrEmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class HrOnboardingService {

    private final HrManagementService managementService;
    private final HrEmploymentContractService contractService;
    private final HrEmployeeRepository employeeRepository;

    @Transactional
    public HrOnboardingDtos.GeneralLaborOnboardingResponse onboardGeneralLabor(
            HrOnboardingDtos.GeneralLaborOnboardingRequest request,
            HrImportActor actor
    ) {
        HrApiDtos.CreateEmployeeRequest employeeRequest = normalizeHireDate(
                request.employee(), request.contract().effectiveFrom());
        HrEmploymentContract replay = contractService.findByIdempotencyKey(request.idempotencyKey()).orElse(null);
        if (replay != null) {
            if (replay.getSourceProbationCandidate() != null
                    || replay.getEmployee().getWorkforceGroup() != HrWorkforceGroup.GENERAL_LABOR
                    || !Objects.equals(replay.getEmployee().getEmployeeCode(),
                    normalizeCode(employeeRequest.personal().employeeCode()))
                    || !contractService.matchesInput(replay, request.contract())) {
                throw HrApiException.conflict("ONBOARDING_IDEMPOTENCY_CONFLICT",
                        "Khóa chống trùng đã được dùng cho một hồ sơ onboarding khác.");
            }
            return response(replay);
        }

        HrApiDtos.EmployeeDetail created = managementService.createEmployeeForOnboarding(
                employeeRequest,
                HrWorkforceGroup.GENERAL_LABOR,
                HrOnboardingSource.DIRECT_GENERAL_LABOR,
                actor
        );
        HrEmployee employee = employeeRepository.findDetailById(created.id())
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND",
                        "Không tìm thấy hồ sơ lao động phổ thông vừa tạo."));
        HrEmploymentContract contract = contractService.createReadyContract(
                employee, null, request.contract(), request.idempotencyKey(), actor);
        return response(contract);
    }

    private HrOnboardingDtos.GeneralLaborOnboardingResponse response(HrEmploymentContract contract) {
        return new HrOnboardingDtos.GeneralLaborOnboardingResponse(
                managementService.getEmployee(contract.getEmployee().getId()),
                contractService.toSummary(contract),
                "CREATE_INCREASE"
        );
    }

    private static HrApiDtos.CreateEmployeeRequest normalizeHireDate(
            HrApiDtos.CreateEmployeeRequest request,
            LocalDate contractStart
    ) {
        HrApiDtos.EmploymentInput input = request.employment();
        if (input == null) {
            throw HrApiException.badRequest("EMPLOYMENT_DETAILS_REQUIRED",
                    "Thông tin công việc là bắt buộc với lao động phổ thông.");
        }
        if (input.hireDate() != null && !Objects.equals(input.hireDate(), contractStart)) {
            throw HrApiException.badRequest("HIRE_DATE_CONTRACT_DATE_MISMATCH",
                    "Ngày vào làm phải trùng ngày hợp đồng có hiệu lực.");
        }
        HrApiDtos.EmploymentInput normalized = new HrApiDtos.EmploymentInput(
                input.departmentId(), input.positionId(), input.workingConditionId(),
                contractStart, input.leaveAccrualStartDate(), input.terminationDate(),
                input.contractTypeLabel(), input.contractNumber(), input.baseSalary(),
                input.allowance(), input.jobDescription()
        );
        return new HrApiDtos.CreateEmployeeRequest(
                request.personal(), normalized, request.identity(), request.insurance(), request.contact());
    }

    private static String normalizeCode(String value) {
        return value == null ? null : value.trim().toUpperCase(java.util.Locale.ROOT);
    }
}

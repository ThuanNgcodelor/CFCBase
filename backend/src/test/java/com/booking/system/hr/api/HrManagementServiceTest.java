package com.booking.system.hr.api;

import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeContact;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeIdentity;
import com.booking.system.hr.entity.HrEmployeeInsurance;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrIdentityVerificationStatus;
import com.booking.system.hr.enums.HrInsuranceStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrDepartmentRepository;
import com.booking.system.hr.repository.HrEmployeeContactRepository;
import com.booking.system.hr.repository.HrEmployeeEmploymentRepository;
import com.booking.system.hr.repository.HrEmployeeIdentityRepository;
import com.booking.system.hr.repository.HrEmployeeInsuranceRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrExcelImportBatchRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.hr.repository.HrPositionRepository;
import com.booking.system.hr.repository.HrWorkingConditionRepository;
import com.booking.system.hr.service.HrManagementService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HrManagementServiceTest {

    @Mock private HrEmployeeRepository employeeRepository;
    @Mock private HrEmployeeEmploymentRepository employmentRepository;
    @Mock private HrEmployeeIdentityRepository identityRepository;
    @Mock private HrEmployeeInsuranceRepository insuranceRepository;
    @Mock private HrEmployeeContactRepository contactRepository;
    @Mock private HrDepartmentRepository departmentRepository;
    @Mock private HrPositionRepository positionRepository;
    @Mock private HrWorkingConditionRepository workingConditionRepository;
    @Mock private HrExcelImportBatchRepository importBatchRepository;
    @Mock private HrMonthlyRosterRepository rosterRepository;
    @Mock private HrAuditEventRepository auditRepository;
    @Mock private EntityManager entityManager;

    private HrManagementService service;
    private HrEmployee employee;

    @BeforeEach
    void setUp() {
        service = new HrManagementService(
                employeeRepository,
                employmentRepository,
                identityRepository,
                insuranceRepository,
                contactRepository,
                departmentRepository,
                positionRepository,
                workingConditionRepository,
                importBatchRepository,
                rosterRepository,
                auditRepository,
                new HrImportJsonCodec(),
                entityManager
        );

        employee = new HrEmployee();
        employee.setId("employee-1");
        employee.setEmployeeCode("NV001");
        employee.setFullName("Nguyễn Văn A");
        employee.setGender(HrEmployeeGender.MALE);
        employee.setEmploymentStatus(HrEmploymentStatus.DRAFT);
        employee.setRowVersion(7L);

        HrEmployeeEmployment employment = new HrEmployeeEmployment();
        employment.setEmployee(employee);
        employment.setEmployeeId(employee.getId());
        employment.setBaseSalary(new BigDecimal("15000000.00"));
        employment.setAllowance(new BigDecimal("1200000.00"));
        employee.setEmployment(employment);

        HrEmployeeIdentity identity = new HrEmployeeIdentity();
        identity.setEmployee(employee);
        identity.setEmployeeId(employee.getId());
        identity.setCitizenIdentityNumber("012345678901");
        identity.setLegacyIdentityNumber("123456789");
        identity.setVerificationStatus(HrIdentityVerificationStatus.VERIFIED);
        employee.setIdentity(identity);

        HrEmployeeInsurance insurance = new HrEmployeeInsurance();
        insurance.setEmployee(employee);
        insurance.setEmployeeId(employee.getId());
        insurance.setSocialInsuranceNumber("BHXH-123456");
        insurance.setHealthInsuranceNumber("BHYT-654321");
        insurance.setStatus(HrInsuranceStatus.ACTIVE);
        employee.setInsurance(insurance);

        HrEmployeeContact contact = new HrEmployeeContact();
        contact.setEmployee(employee);
        contact.setEmployeeId(employee.getId());
        contact.setPhone("123");
        contact.setWorkEmail("employee@cfc.test");
        contact.setPermanentAddress("Địa chỉ đang được bảo vệ");
        employee.setContact(contact);
    }

    @Test
    void updateDraftPreservesProtectedValuesWhenMaskedFieldsAreOmitted() {
        when(employeeRepository.findDetailById(employee.getId())).thenReturn(Optional.of(employee));
        when(employeeRepository.findByEmployeeCode("NV001")).thenReturn(Optional.of(employee));

        HrApiDtos.EmployeeDetail result = service.updateEmployee(
                employee.getId(), updateRequest(employee.getRowVersion()), managerActor());

        assertThat(employee.getEmployment().getBaseSalary()).isEqualByComparingTo("15000000.00");
        assertThat(employee.getEmployment().getAllowance()).isEqualByComparingTo("1200000.00");
        assertThat(employee.getIdentity().getCitizenIdentityNumber()).isEqualTo("012345678901");
        assertThat(employee.getIdentity().getLegacyIdentityNumber()).isEqualTo("123456789");
        assertThat(employee.getInsurance().getSocialInsuranceNumber()).isEqualTo("BHXH-123456");
        assertThat(employee.getInsurance().getHealthInsuranceNumber()).isEqualTo("BHYT-654321");
        assertThat(employee.getContact().getPhone()).isEqualTo("123");
        assertThat(employee.getContact().getWorkEmail()).isEqualTo("employee@cfc.test");
        assertThat(employee.getContact().getPermanentAddress()).isEqualTo("Địa chỉ đang được bảo vệ");

        assertThat(result.employment().hasCompensationData()).isTrue();
        assertThat(result.identity().citizenIdentityNumber()).endsWith("8901").doesNotContain("01234567");
        assertThat(result.insurance().socialInsuranceNumber()).endsWith("3456").doesNotContain("BHXH-12");
        assertThat(result.contact().phone()).isEqualTo("••••").doesNotContain("123");
    }

    @Test
    void updateRejectsEmployeeOutsideDraftState() {
        employee.setEmploymentStatus(HrEmploymentStatus.ACTIVE);
        when(employeeRepository.findDetailById(employee.getId())).thenReturn(Optional.of(employee));

        assertThatThrownBy(() -> service.updateEmployee(
                employee.getId(), updateRequest(employee.getRowVersion()), managerActor()))
                .isInstanceOf(HrApiException.class)
                .satisfies(error -> {
                    HrApiException apiError = (HrApiException) error;
                    assertThat(apiError.status().value()).isEqualTo(409);
                    assertThat(apiError.code()).isEqualTo("EMPLOYEE_NOT_DRAFT");
                });
    }

    private static HrApiDtos.UpdateEmployeeRequest updateRequest(long rowVersion) {
        return new HrApiDtos.UpdateEmployeeRequest(
                rowVersion,
                new HrApiDtos.PersonalInput(
                        "NV001", "Nguyễn Văn A cập nhật", HrEmployeeGender.MALE,
                        LocalDate.of(1990, 1, 1), null, null, null, null, null, null),
                new HrApiDtos.EmploymentInput(
                        null, null, null, LocalDate.of(2020, 1, 1), null, null,
                        null, null, null, null, "Mô tả mới"),
                new HrApiDtos.IdentityInput(
                        null, null, null, null, HrIdentityVerificationStatus.VERIFIED),
                new HrApiDtos.InsuranceInput(
                        null, null, null, null, HrInsuranceStatus.ACTIVE),
                new HrApiDtos.ContactInput(null, null, null, null, null, null, null, null)
        );
    }

    private static HrImportActor managerActor() {
        return new HrImportActor("USER:manager-1", "HR Manager", "MANAGER");
    }
}

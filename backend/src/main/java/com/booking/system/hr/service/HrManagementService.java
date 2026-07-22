package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrDepartment;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeContact;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeIdentity;
import com.booking.system.hr.entity.HrEmployeeInsurance;
import com.booking.system.hr.entity.HrExcelImportBatch;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.entity.HrPosition;
import com.booking.system.hr.entity.HrWorkingCondition;
import com.booking.system.hr.enums.HrCatalogStatus;
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
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class HrManagementService {

    private final HrEmployeeRepository employeeRepository;
    private final HrEmployeeEmploymentRepository employmentRepository;
    private final HrEmployeeIdentityRepository identityRepository;
    private final HrEmployeeInsuranceRepository insuranceRepository;
    private final HrEmployeeContactRepository contactRepository;
    private final HrDepartmentRepository departmentRepository;
    private final HrPositionRepository positionRepository;
    private final HrWorkingConditionRepository workingConditionRepository;
    private final HrExcelImportBatchRepository importBatchRepository;
    private final HrMonthlyRosterRepository rosterRepository;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public HrApiDtos.OverviewResponse overview() {
        HrExcelImportBatch latestImport = importBatchRepository
                .findAll(PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream().findFirst().orElse(null);
        HrMonthlyRoster latestRoster = rosterRepository
                .findAll(PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "periodStart")))
                .stream().findFirst().orElse(null);

        return new HrApiDtos.OverviewResponse(
                employeeRepository.count(),
                employeeRepository.countByEmploymentStatus(HrEmploymentStatus.ACTIVE),
                employeeRepository.countByEmploymentStatus(HrEmploymentStatus.DRAFT),
                employeeRepository.countByEmploymentStatus(HrEmploymentStatus.INACTIVE),
                departmentRepository.countByStatus(HrCatalogStatus.ACTIVE),
                positionRepository.countByStatus(HrCatalogStatus.ACTIVE),
                workingConditionRepository.countByStatus(HrCatalogStatus.ACTIVE),
                latestImport == null ? null : new HrApiDtos.ImportSummary(
                        latestImport.getId(), latestImport.getStatus(), latestImport.getTotalRows(),
                        latestImport.getImportedRows(), latestImport.getParsedAt(),
                        latestImport.getValidatedAt(), latestImport.getConfirmedAt()),
                latestRoster == null ? null : new HrApiDtos.RosterSummary(
                        latestRoster.getId(), latestRoster.getPeriodStart(), latestRoster.getStatus(),
                        latestRoster.getItemCount())
        );
    }

    @Transactional(readOnly = true)
    public Page<HrApiDtos.EmployeeListItem> searchEmployees(
            String keyword,
            HrEmploymentStatus status,
            String departmentId,
            String positionId,
            String workingConditionId,
            Pageable pageable
    ) {
        return employeeRepository.search(
                likePattern(keyword), status, blankToNull(departmentId), blankToNull(positionId),
                blankToNull(workingConditionId), pageable
        ).map(this::toListItem);
    }

    @Transactional(readOnly = true)
    public HrApiDtos.EmployeeDetail getEmployee(String employeeId) {
        return toDetail(requireEmployee(employeeId));
    }

    @Transactional
    public HrApiDtos.EmployeeDetail createEmployee(
            HrApiDtos.CreateEmployeeRequest request,
            HrImportActor actor
    ) {
        String employeeCode = normalizeCode(request.personal().employeeCode());
        requireUniqueEmployeeCode(employeeCode, null);
        validatePersonal(request.personal());
        validateEmployment(request.employment());
        validateInsurance(request.insurance());

        HrEmployee employee = new HrEmployee();
        copyPersonal(employee, request.personal());
        employee.setEmployeeCode(employeeCode);
        employee.setEmploymentStatus(HrEmploymentStatus.DRAFT);
        employee.setStatusEffectiveDate(null);
        setCreatedAudit(employee, actor);
        employee = employeeRepository.save(employee);

        if (request.employment() != null) upsertEmployment(employee, request.employment(), actor);
        if (request.identity() != null) upsertIdentity(employee, request.identity(), actor);
        if (request.insurance() != null) upsertInsurance(employee, request.insurance(), actor);
        if (request.contact() != null) upsertContact(employee, request.contact(), actor);

        audit(actor, "HR_EMPLOYEE_CREATED", "HR_EMPLOYEE", employee.getId(),
                List.of("personal", "employment", "identity", "insurance", "contact"),
                Map.of("employmentStatus", HrEmploymentStatus.DRAFT.name()));
        entityManager.flush();
        return toDetail(employeeRepository.findDetailById(employee.getId()).orElseThrow());
    }

    @Transactional
    public HrApiDtos.EmployeeDetail updateEmployee(
            String employeeId,
            HrApiDtos.UpdateEmployeeRequest request,
            HrImportActor actor
    ) {
        HrEmployee employee = requireEmployee(employeeId);
        if (employee.getEmploymentStatus() != HrEmploymentStatus.DRAFT) {
            throw HrApiException.conflict("EMPLOYEE_NOT_DRAFT",
                    "Chỉ hồ sơ nhân sự ở trạng thái bản nháp mới được chỉnh sửa trực tiếp.");
        }
        if (employee.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("STALE_EMPLOYEE_VERSION",
                    "Hồ sơ đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
        }

        String employeeCode = normalizeCode(request.personal().employeeCode());
        requireUniqueEmployeeCode(employeeCode, employeeId);
        validatePersonal(request.personal());
        validateEmployment(request.employment());
        validateInsurance(request.insurance());

        copyPersonal(employee, request.personal());
        employee.setEmployeeCode(employeeCode);
        touch(employee, actor);
        employeeRepository.save(employee);

        if (request.employment() != null) upsertEmployment(employee, request.employment(), actor);
        if (request.identity() != null) upsertIdentity(employee, request.identity(), actor);
        if (request.insurance() != null) upsertInsurance(employee, request.insurance(), actor);
        if (request.contact() != null) upsertContact(employee, request.contact(), actor);

        audit(actor, "HR_EMPLOYEE_UPDATED", "HR_EMPLOYEE", employee.getId(),
                List.of("personal", "employment", "identity", "insurance", "contact"), Map.of());
        entityManager.flush();
        return toDetail(employeeRepository.findDetailById(employee.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public Page<HrApiDtos.CatalogResponse> searchCatalog(
            String type,
            HrCatalogStatus status,
            String keyword,
            Pageable pageable
    ) {
        String pattern = likePattern(keyword);
        return switch (catalogType(type)) {
            case DEPARTMENTS -> departmentRepository.search(status, pattern, pageable).map(this::toCatalog);
            case POSITIONS -> positionRepository.search(status, pattern, pageable).map(this::toCatalog);
            case WORKING_CONDITIONS -> workingConditionRepository.search(status, pattern, pageable).map(this::toCatalog);
        };
    }

    @Transactional
    public HrApiDtos.CatalogResponse createCatalog(
            String type,
            HrApiDtos.CreateCatalogRequest request,
            HrImportActor actor
    ) {
        CatalogType catalogType = catalogType(type);
        String code = normalizeCode(request.code());
        String name = requiredText(request.name(), "Tên danh mục là bắt buộc");
        requireUniqueCatalog(catalogType, code, name, null);

        HrCatalogEntity entity = switch (catalogType) {
            case DEPARTMENTS -> new HrDepartment();
            case POSITIONS -> new HrPosition();
            case WORKING_CONDITIONS -> new HrWorkingCondition();
        };
        copyCatalog(entity, code, name, request.description(), request.sortOrder(), actor);
        if (entity instanceof HrDepartment department) {
            department.setParent(resolveParent(request.parentId(), null));
            entity = departmentRepository.save(department);
        } else if (entity instanceof HrPosition position) {
            rejectParentForFlatCatalog(request.parentId());
            entity = positionRepository.save(position);
        } else if (entity instanceof HrWorkingCondition condition) {
            rejectParentForFlatCatalog(request.parentId());
            entity = workingConditionRepository.save(condition);
        }

        audit(actor, "HR_CATALOG_CREATED", catalogType.entityType, entity.getId(),
                List.of("code", "name", "description", "sortOrder", "parentId"),
                Map.of("catalogType", catalogType.path));
        entityManager.flush();
        return toCatalog(entity);
    }

    @Transactional
    public HrApiDtos.CatalogResponse updateCatalog(
            String type,
            String catalogId,
            HrApiDtos.UpdateCatalogRequest request,
            HrImportActor actor
    ) {
        CatalogType catalogType = catalogType(type);
        HrCatalogEntity entity = requireCatalog(catalogType, catalogId);
        if (entity.getRowVersion() != request.rowVersion()) {
            throw HrApiException.conflict("STALE_CATALOG_VERSION",
                    "Danh mục đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
        }

        String code = normalizeCode(request.code());
        String name = requiredText(request.name(), "Tên danh mục là bắt buộc");
        requireUniqueCatalog(catalogType, code, name, catalogId);
        if (request.status() != null && request.status() != entity.getStatus()) {
            if (request.status() != HrCatalogStatus.INACTIVE) {
                throw HrApiException.badRequest("CATALOG_REACTIVATION_NOT_AVAILABLE",
                        "Phase 3 chỉ cho phép ngừng sử dụng danh mục; chưa hỗ trợ kích hoạt lại.");
            }
            entity.setStatus(HrCatalogStatus.INACTIVE);
        }
        entity.setCode(code);
        entity.setName(name);
        entity.setDescription(trimToNull(request.description()));
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        touch(entity, actor);

        if (entity instanceof HrDepartment department) {
            department.setParent(resolveParent(request.parentId(), department));
            entity = departmentRepository.save(department);
        } else if (entity instanceof HrPosition position) {
            rejectParentForFlatCatalog(request.parentId());
            entity = positionRepository.save(position);
        } else if (entity instanceof HrWorkingCondition condition) {
            rejectParentForFlatCatalog(request.parentId());
            entity = workingConditionRepository.save(condition);
        }

        audit(actor, "HR_CATALOG_UPDATED", catalogType.entityType, entity.getId(),
                List.of("code", "name", "description", "sortOrder", "parentId", "status"),
                Map.of("catalogType", catalogType.path, "status", entity.getStatus().name()));
        entityManager.flush();
        return toCatalog(entity);
    }

    private HrEmployee requireEmployee(String id) {
        return employeeRepository.findDetailById(id)
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND", "Không tìm thấy hồ sơ nhân sự."));
    }

    private void requireUniqueEmployeeCode(String code, String currentId) {
        employeeRepository.findByEmployeeCode(code).ifPresent(existing -> {
            if (!Objects.equals(existing.getId(), currentId)) {
                throw HrApiException.conflict("EMPLOYEE_CODE_EXISTS", "Mã nhân sự đã tồn tại.");
            }
        });
    }

    private void copyPersonal(HrEmployee employee, HrApiDtos.PersonalInput input) {
        employee.setEmployeeCode(normalizeCode(input.employeeCode()));
        employee.setFullName(requiredText(input.fullName(), "Họ tên là bắt buộc"));
        employee.setGender(input.gender() == null ? HrEmployeeGender.UNKNOWN : input.gender());
        employee.setDateOfBirth(input.dateOfBirth());
        employee.setEthnicity(trimToNull(input.ethnicity()));
        employee.setReligion(trimToNull(input.religion()));
        employee.setBirthPlaceOriginal(trimToNull(input.birthPlaceOriginal()));
        employee.setBirthPlaceCurrent(trimToNull(input.birthPlaceCurrent()));
        employee.setEducationLevel(trimToNull(input.educationLevel()));
        employee.setMajor(trimToNull(input.major()));
    }

    private void validatePersonal(HrApiDtos.PersonalInput input) {
        if (input.dateOfBirth() != null && input.dateOfBirth().isAfter(LocalDate.now(ZoneOffset.UTC))) {
            throw HrApiException.badRequest("DATE_OF_BIRTH_IN_FUTURE", "Ngày sinh không được nằm trong tương lai.");
        }
    }

    private void validateEmployment(HrApiDtos.EmploymentInput input) {
        if (input != null && input.hireDate() != null && input.terminationDate() != null
                && input.terminationDate().isBefore(input.hireDate())) {
            throw HrApiException.badRequest("INVALID_EMPLOYMENT_DATES",
                    "Ngày ngừng làm việc không được trước ngày vào làm.");
        }
    }

    private void validateInsurance(HrApiDtos.InsuranceInput input) {
        if (input != null && input.validFrom() != null && input.validUntil() != null
                && input.validUntil().isBefore(input.validFrom())) {
            throw HrApiException.badRequest("INVALID_INSURANCE_DATES",
                    "Ngày hết hạn bảo hiểm không được trước ngày bắt đầu.");
        }
    }

    private void upsertEmployment(HrEmployee employee, HrApiDtos.EmploymentInput input, HrImportActor actor) {
        HrEmployeeEmployment employment = employee.getEmployment();
        boolean created = employment == null;
        if (created) {
            employment = new HrEmployeeEmployment();
            employment.setEmployee(employee);
            setCreatedAudit(employment, actor);
        } else {
            touch(employment, actor);
        }
        employment.setDepartment(catalogById(departmentRepository, input.departmentId(), "Không tìm thấy phòng ban HR."));
        employment.setPosition(catalogById(positionRepository, input.positionId(), "Không tìm thấy chức vụ HR."));
        employment.setWorkingCondition(catalogById(workingConditionRepository, input.workingConditionId(),
                "Không tìm thấy điều kiện lao động."));
        employment.setHireDate(input.hireDate());
        employment.setLeaveAccrualStartDate(input.leaveAccrualStartDate());
        employment.setTerminationDate(input.terminationDate());
        employment.setContractTypeLabel(trimToNull(input.contractTypeLabel()));
        employment.setContractNumber(trimToNull(input.contractNumber()));
        // Detail responses never expose compensation values. During an edit, an
        // omitted/null value therefore means "keep the protected value", not
        // "erase it". A non-null value is an explicit replacement.
        if (created || input.baseSalary() != null) {
            employment.setBaseSalary(input.baseSalary());
        }
        if (created || input.allowance() != null) {
            employment.setAllowance(input.allowance());
        }
        employment.setJobDescription(trimToNull(input.jobDescription()));
        employmentRepository.save(employment);
        employee.setEmployment(employment);
    }

    private void upsertIdentity(HrEmployee employee, HrApiDtos.IdentityInput input, HrImportActor actor) {
        HrEmployeeIdentity identity = employee.getIdentity();
        if (identity == null) {
            identity = new HrEmployeeIdentity();
            identity.setEmployee(employee);
            setCreatedAudit(identity, actor);
        } else {
            touch(identity, actor);
        }
        // Identity numbers are masked in reads, so missing values on update
        // must preserve the stored originals.
        if (identity.getEmployeeId() == null || input.legacyIdentityNumber() != null) {
            identity.setLegacyIdentityNumber(trimToNull(input.legacyIdentityNumber()));
        }
        if (identity.getEmployeeId() == null || input.citizenIdentityNumber() != null) {
            identity.setCitizenIdentityNumber(trimToNull(input.citizenIdentityNumber()));
        }
        identity.setIssuedDate(input.issuedDate());
        identity.setIssuedPlace(trimToNull(input.issuedPlace()));
        identity.setVerificationStatus(input.verificationStatus() == null
                ? HrIdentityVerificationStatus.UNVERIFIED : input.verificationStatus());
        identityRepository.save(identity);
        employee.setIdentity(identity);
    }

    private void upsertInsurance(HrEmployee employee, HrApiDtos.InsuranceInput input, HrImportActor actor) {
        HrEmployeeInsurance insurance = employee.getInsurance();
        if (insurance == null) {
            insurance = new HrEmployeeInsurance();
            insurance.setEmployee(employee);
            setCreatedAudit(insurance, actor);
        } else {
            touch(insurance, actor);
        }
        // Insurance numbers follow the same masked round-trip contract.
        if (insurance.getEmployeeId() == null || input.socialInsuranceNumber() != null) {
            insurance.setSocialInsuranceNumber(trimToNull(input.socialInsuranceNumber()));
        }
        if (insurance.getEmployeeId() == null || input.healthInsuranceNumber() != null) {
            insurance.setHealthInsuranceNumber(trimToNull(input.healthInsuranceNumber()));
        }
        insurance.setValidFrom(input.validFrom());
        insurance.setValidUntil(input.validUntil());
        insurance.setStatus(input.status() == null ? HrInsuranceStatus.UNKNOWN : input.status());
        insuranceRepository.save(insurance);
        employee.setInsurance(insurance);
    }

    private void upsertContact(HrEmployee employee, HrApiDtos.ContactInput input, HrImportActor actor) {
        HrEmployeeContact contact = employee.getContact();
        if (contact == null) {
            contact = new HrEmployeeContact();
            contact.setEmployee(employee);
            setCreatedAudit(contact, actor);
        } else {
            touch(contact, actor);
        }
        // Every contact field is protected or masked in the detail response.
        // Only non-null fields are replacements for an existing record.
        boolean created = contact.getEmployeeId() == null;
        if (created || input.permanentAddress() != null) {
            contact.setPermanentAddress(trimToNull(input.permanentAddress()));
        }
        if (created || input.currentAddress() != null) {
            contact.setCurrentAddress(trimToNull(input.currentAddress()));
        }
        if (created || input.phone() != null) {
            contact.setPhone(trimToNull(input.phone()));
        }
        if (created || input.workEmail() != null) {
            contact.setWorkEmail(normalizeEmail(input.workEmail()));
        }
        if (created || input.personalEmail() != null) {
            contact.setPersonalEmail(normalizeEmail(input.personalEmail()));
        }
        if (created || input.emergencyContactName() != null) {
            contact.setEmergencyContactName(trimToNull(input.emergencyContactName()));
        }
        if (created || input.emergencyContactPhone() != null) {
            contact.setEmergencyContactPhone(trimToNull(input.emergencyContactPhone()));
        }
        if (created || input.emergencyContactRelation() != null) {
            contact.setEmergencyContactRelation(trimToNull(input.emergencyContactRelation()));
        }
        contactRepository.save(contact);
        employee.setContact(contact);
    }

    private HrApiDtos.EmployeeListItem toListItem(HrEmployee employee) {
        HrEmployeeEmployment employment = employee.getEmployment();
        return new HrApiDtos.EmployeeListItem(
                employee.getId(), employee.getEmployeeCode(), employee.getFullName(), employee.getGender(),
                employee.getEmploymentStatus(), employee.getStatusEffectiveDate(),
                id(employment == null ? null : employment.getDepartment()),
                code(employment == null ? null : employment.getDepartment()),
                name(employment == null ? null : employment.getDepartment()),
                id(employment == null ? null : employment.getPosition()),
                code(employment == null ? null : employment.getPosition()),
                name(employment == null ? null : employment.getPosition()),
                id(employment == null ? null : employment.getWorkingCondition()),
                code(employment == null ? null : employment.getWorkingCondition()),
                name(employment == null ? null : employment.getWorkingCondition()),
                employment == null ? null : employment.getHireDate(), employee.getRowVersion(), employee.getUpdatedAt()
        );
    }

    private HrApiDtos.EmployeeDetail toDetail(HrEmployee employee) {
        HrEmployeeEmployment employment = employee.getEmployment();
        HrEmployeeIdentity identity = employee.getIdentity();
        HrEmployeeInsurance insurance = employee.getInsurance();
        HrEmployeeContact contact = employee.getContact();
        return new HrApiDtos.EmployeeDetail(
                employee.getId(), employee.getEmploymentStatus(), employee.getStatusEffectiveDate(),
                employee.getRowVersion(), employee.getCreatedAt(), employee.getUpdatedAt(),
                new HrApiDtos.PersonalDetails(
                        employee.getEmployeeCode(), employee.getFullName(), employee.getGender(),
                        employee.getDateOfBirth(), employee.getEthnicity(), employee.getReligion(),
                        employee.getBirthPlaceOriginal(), employee.getBirthPlaceCurrent(),
                        employee.getEducationLevel(), employee.getMajor()),
                employment == null ? null : new HrApiDtos.EmploymentDetails(
                        ref(employment.getDepartment()), ref(employment.getPosition()),
                        ref(employment.getWorkingCondition()), employment.getHireDate(),
                        employment.getLeaveAccrualStartDate(), employment.getTerminationDate(),
                        employment.getContractTypeLabel(), employment.getContractNumber(),
                        employment.getBaseSalary() != null || employment.getAllowance() != null,
                        employment.getJobDescription()),
                identity == null ? null : new HrApiDtos.IdentityDetails(
                        maskTail(identity.getLegacyIdentityNumber(), 4),
                        maskTail(identity.getCitizenIdentityNumber(), 4), identity.getIssuedDate(),
                        identity.getIssuedPlace(), identity.getVerificationStatus()),
                insurance == null ? null : new HrApiDtos.InsuranceDetails(
                        maskTail(insurance.getSocialInsuranceNumber(), 4),
                        maskTail(insurance.getHealthInsuranceNumber(), 4), insurance.getValidFrom(),
                        insurance.getValidUntil(), insurance.getStatus()),
                contact == null ? null : new HrApiDtos.ContactDetails(
                        protectedValue(contact.getPermanentAddress()), protectedValue(contact.getCurrentAddress()),
                        maskTail(contact.getPhone(), 3), maskEmail(contact.getWorkEmail()),
                        maskEmail(contact.getPersonalEmail()), protectedValue(contact.getEmergencyContactName()),
                        maskTail(contact.getEmergencyContactPhone(), 3),
                        protectedValue(contact.getEmergencyContactRelation()))
        );
    }

    private HrApiDtos.CatalogResponse toCatalog(HrCatalogEntity entity) {
        HrDepartment parent = entity instanceof HrDepartment department ? department.getParent() : null;
        return new HrApiDtos.CatalogResponse(
                entity.getId(), entity.getCode(), entity.getName(), entity.getDescription(), entity.getStatus(),
                entity.getSortOrder(), parent == null ? null : parent.getId(),
                parent == null ? null : parent.getName(), entity.getRowVersion(), entity.getUpdatedAt());
    }

    private HrApiDtos.CatalogRef ref(HrCatalogEntity entity) {
        return entity == null ? null : new HrApiDtos.CatalogRef(entity.getId(), entity.getCode(), entity.getName());
    }

    private void copyCatalog(HrCatalogEntity entity, String code, String name, String description,
                             Integer sortOrder, HrImportActor actor) {
        entity.setCode(code);
        entity.setName(name);
        entity.setDescription(trimToNull(description));
        entity.setStatus(HrCatalogStatus.ACTIVE);
        entity.setSortOrder(sortOrder == null ? 0 : sortOrder);
        setCreatedAudit(entity, actor);
    }

    private HrCatalogEntity requireCatalog(CatalogType type, String id) {
        return switch (type) {
            case DEPARTMENTS -> departmentRepository.findById(id).orElseThrow(() -> catalogNotFound(type));
            case POSITIONS -> positionRepository.findById(id).orElseThrow(() -> catalogNotFound(type));
            case WORKING_CONDITIONS -> workingConditionRepository.findById(id).orElseThrow(() -> catalogNotFound(type));
        };
    }

    private HrApiException catalogNotFound(CatalogType type) {
        return HrApiException.notFound("CATALOG_NOT_FOUND", "Không tìm thấy danh mục " + type.path + ".");
    }

    private void requireUniqueCatalog(CatalogType type, String code, String name, String currentId) {
        HrCatalogEntity byCode = switch (type) {
            case DEPARTMENTS -> departmentRepository.findByCode(code).orElse(null);
            case POSITIONS -> positionRepository.findByCode(code).orElse(null);
            case WORKING_CONDITIONS -> workingConditionRepository.findByCode(code).orElse(null);
        };
        HrCatalogEntity byName = switch (type) {
            case DEPARTMENTS -> departmentRepository.findByName(name).orElse(null);
            case POSITIONS -> positionRepository.findByName(name).orElse(null);
            case WORKING_CONDITIONS -> workingConditionRepository.findByName(name).orElse(null);
        };
        if ((byCode != null && !Objects.equals(byCode.getId(), currentId))
                || (byName != null && !Objects.equals(byName.getId(), currentId))) {
            throw HrApiException.conflict("CATALOG_DUPLICATE", "Mã hoặc tên danh mục đã tồn tại.");
        }
    }

    private HrDepartment resolveParent(String parentId, HrDepartment current) {
        String normalized = blankToNull(parentId);
        if (normalized == null) return null;
        if (current != null && normalized.equals(current.getId())) {
            throw HrApiException.badRequest("CATALOG_PARENT_CYCLE", "Phòng ban không thể là cấp trên của chính nó.");
        }
        HrDepartment parent = departmentRepository.findById(normalized)
                .orElseThrow(() -> HrApiException.notFound("PARENT_DEPARTMENT_NOT_FOUND",
                        "Không tìm thấy phòng ban cấp trên."));
        HrDepartment cursor = parent;
        while (cursor != null) {
            if (current != null && current.getId().equals(cursor.getId())) {
                throw HrApiException.badRequest("CATALOG_PARENT_CYCLE", "Cấu trúc phòng ban tạo thành vòng lặp.");
            }
            cursor = cursor.getParent();
        }
        return parent;
    }

    private void rejectParentForFlatCatalog(String parentId) {
        if (blankToNull(parentId) != null) {
            throw HrApiException.badRequest("CATALOG_PARENT_NOT_SUPPORTED",
                    "Chỉ danh mục phòng ban hỗ trợ cấp trên.");
        }
    }

    private <T extends HrCatalogEntity> T catalogById(
            com.booking.system.hr.repository.HrRepository<T, String> repository,
            String id,
            String message
    ) {
        String normalized = blankToNull(id);
        if (normalized == null) return null;
        return repository.findById(normalized)
                .orElseThrow(() -> HrApiException.notFound("CATALOG_NOT_FOUND", message));
    }

    private void audit(HrImportActor actor, String action, String entityType, String entityId,
                       List<String> changedFields, Map<String, ?> metadata) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction(action);
        event.setEntityType(entityType);
        event.setEntityId(entityId);
        try {
            event.setChangedFields(jsonCodec.write(changedFields));
            event.setSanitizedMetadata(jsonCodec.write(metadata));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi audit HR đã lọc.", exception);
        }
        auditRepository.save(event);
    }

    private static void setCreatedAudit(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private static void touch(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setUpdatedByActor(actor.subject());
        // Guarantees an employee version bump even when only a one-to-one section changed.
        entity.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
    }

    private static String likePattern(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : "%" + normalized.toLowerCase(Locale.ROOT) + "%";
    }

    private static String normalizeCode(String value) {
        return requiredText(value, "Mã là bắt buộc").toUpperCase(Locale.ROOT);
    }

    private static String requiredText(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) throw HrApiException.badRequest("REQUIRED_VALUE", message);
        return normalized;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String blankToNull(String value) {
        return trimToNull(value);
    }

    private static String normalizeEmail(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private static String maskTail(String value, int visible) {
        String normalized = trimToNull(value);
        if (normalized == null) return null;
        // A malformed/legacy short identifier must not become fully visible
        // just because it is shorter than the usual visible tail.
        if (normalized.length() <= visible) {
            return "•".repeat(Math.max(4, normalized.length()));
        }
        int shown = visible;
        return "•".repeat(Math.max(4, normalized.length() - shown))
                + normalized.substring(normalized.length() - shown);
    }

    private static String maskEmail(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) return null;
        int at = normalized.indexOf('@');
        if (at <= 0) return protectedValue(normalized);
        String local = normalized.substring(0, at);
        String visible = local.substring(0, Math.min(2, local.length()));
        return visible + "•••" + normalized.substring(at);
    }

    private static String protectedValue(String value) {
        return trimToNull(value) == null ? null : "Đã lưu (được bảo vệ)";
    }

    private static String id(HrCatalogEntity value) {
        return value == null ? null : value.getId();
    }

    private static String code(HrCatalogEntity value) {
        return value == null ? null : value.getCode();
    }

    private static String name(HrCatalogEntity value) {
        return value == null ? null : value.getName();
    }

    private enum CatalogType {
        DEPARTMENTS("departments", "HR_DEPARTMENT"),
        POSITIONS("positions", "HR_POSITION"),
        WORKING_CONDITIONS("working-conditions", "HR_WORKING_CONDITION");

        private final String path;
        private final String entityType;

        CatalogType(String path, String entityType) {
            this.path = path;
            this.entityType = entityType;
        }
    }

    private static CatalogType catalogType(String value) {
        for (CatalogType type : CatalogType.values()) {
            if (type.path.equals(value)) return type;
        }
        throw HrApiException.badRequest("CATALOG_TYPE_INVALID", "Loại danh mục HR không hợp lệ.");
    }
}

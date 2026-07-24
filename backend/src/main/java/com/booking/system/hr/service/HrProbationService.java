package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrProbationDtos;
import com.booking.system.hr.dto.HrApiDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrCatalogEntity;
import com.booking.system.hr.entity.HrDepartment;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrPosition;
import com.booking.system.hr.entity.HrProbationCandidate;
import com.booking.system.hr.entity.HrProbationContract;
import com.booking.system.hr.entity.HrProbationJobTemplate;
import com.booking.system.hr.entity.HrWorkingCondition;
import com.booking.system.hr.enums.HrCatalogStatus;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrIdentityVerificationStatus;
import com.booking.system.hr.enums.HrProbationCandidateStatus;
import com.booking.system.hr.enums.HrProbationContractStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrDepartmentRepository;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrPositionRepository;
import com.booking.system.hr.repository.HrProbationCandidateRepository;
import com.booking.system.hr.repository.HrProbationContractRepository;
import com.booking.system.hr.repository.HrProbationJobTemplateRepository;
import com.booking.system.hr.repository.HrRepository;
import com.booking.system.hr.repository.HrWorkingConditionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class HrProbationService {

    private static final String TEMPLATE_PATH = "/hr/templates/probation-contract-template.docx";
    private static final String TEMPLATE_FILE_NAME = "probation-contract-template.docx";
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter CODE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyMMddHHmmss");
    private static final Pattern NON_FILE_NAME = Pattern.compile("[^a-zA-Z0-9._-]+");

    private final HrProbationCandidateRepository candidateRepository;
    private final HrProbationContractRepository contractRepository;
    private final HrProbationJobTemplateRepository jobTemplateRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrDepartmentRepository departmentRepository;
    private final HrPositionRepository positionRepository;
    private final HrWorkingConditionRepository workingConditionRepository;
    private final HrManagementService managementService;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;

    @Transactional(readOnly = true)
    public HrPageResponse<HrProbationDtos.CandidateSummary> searchCandidates(
            String keyword,
            HrProbationCandidateStatus status,
            String departmentId,
            Pageable pageable
    ) {
        Page<HrProbationDtos.CandidateSummary> result = candidateRepository.search(
                likePattern(keyword), status, blankToNull(departmentId), pageable
        ).map(this::toSummary);
        return HrPageResponse.from(result, item -> item);
    }

    @Transactional(readOnly = true)
    public HrProbationDtos.CandidateDetail getCandidate(String candidateId) {
        return toDetail(requireCandidate(candidateId));
    }

    @Transactional
    public HrProbationDtos.CandidateDetail createCandidate(
            HrProbationDtos.CandidateInput input,
            HrImportActor actor
    ) {
        validateCandidateInput(input);
        HrProbationCandidate candidate = new HrProbationCandidate();
        copyCandidate(candidate, input, actor, true);
        setCreatedAudit(candidate, actor);
        candidate = candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_CANDIDATE_CREATED", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("candidate", "probation", "contract"), Map.of("status", candidate.getStatus().name()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional
    public HrProbationDtos.CandidateDetail updateCandidate(
            String candidateId,
            HrProbationDtos.UpdateCandidateRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        requireVersion(candidate.getRowVersion(), request.rowVersion(), "STALE_PROBATION_CANDIDATE_VERSION",
                "Ứng viên đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        if (candidate.getStatus() == HrProbationCandidateStatus.CONVERTED) {
            throw HrApiException.conflict("PROBATION_CANDIDATE_CONVERTED",
                    "Ứng viên đã chuyển thành hồ sơ nhân sự nên không thể sửa trực tiếp.");
        }
        validateCandidateInput(request.candidate());
        copyCandidate(candidate, request.candidate(), actor, false);
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_CANDIDATE_UPDATED", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("candidate", "probation", "contract"), Map.of("status", candidate.getStatus().name()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional
    public HrProbationDtos.ContractSummary generateContract(
            String candidateId,
            HrProbationDtos.GenerateContractRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        if (candidate.getStatus() == HrProbationCandidateStatus.CONVERTED
                || candidate.getStatus() == HrProbationCandidateStatus.FAILED
                || candidate.getStatus() == HrProbationCandidateStatus.CANCELLED) {
            throw HrApiException.conflict("PROBATION_CONTRACT_STATUS_INVALID",
                    "Trạng thái ứng viên hiện tại không thể tạo hợp đồng thử việc.");
        }
        validateContractRequiredFields(candidate);

        LocalDate signDate = request.signDate() == null ? LocalDate.now(ZoneOffset.UTC) : request.signDate();
        short contractYear = (short) signDate.getYear();
        String contractNo = resolveContractNo(request.contractNo(), contractYear);
        byte[] template = readTemplateBytes();
        String templateSha256 = sha256(template);

        Map<String, String> placeholders = contractPlaceholders(candidate, signDate, contractNo, contractYear);
        byte[] generated = fillDocxTemplate(template, placeholders);
        String generatedSha256 = sha256(generated);

        HrProbationContract contract = new HrProbationContract();
        contract.setCandidate(candidate);
        contract.setContractNo(contractNo);
        contract.setContractYear(contractYear);
        contract.setTemplateFileName(TEMPLATE_FILE_NAME);
        contract.setTemplateSha256(templateSha256);
        contract.setGeneratedFileName(contractFileName(candidate, contractNo, contractYear));
        contract.setGeneratedFileSha256(generatedSha256);
        contract.setGeneratedDocx(generated);
        contract.setStatus(HrProbationContractStatus.GENERATED);
        contract.setGeneratedAt(LocalDateTime.now(ZoneOffset.UTC));
        contract.setGeneratedByActor(actor.subject());
        try {
            contract.setSnapshotPayload(jsonCodec.write(placeholders));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi snapshot hợp đồng thử việc.", exception);
        }
        setCreatedAudit(contract, actor);
        contract = contractRepository.save(contract);

        if (candidate.getStatus() == HrProbationCandidateStatus.DRAFT) {
            candidate.setStatus(HrProbationCandidateStatus.CONTRACT_CREATED);
        }
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_CONTRACT_GENERATED", "HR_PROBATION_CONTRACT", contract.getId(),
                List.of("contractNo", "templateSha256", "generatedFileSha256"),
                Map.of("candidateId", candidate.getId(), "candidateCode", candidate.getCandidateCode()));
        return toContractSummary(contract);
    }

    @Transactional(readOnly = true)
    public HrProbationDtos.ContractFile downloadContract(String contractId) {
        HrProbationContract contract = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> HrApiException.notFound("PROBATION_CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng thử việc."));
        return new HrProbationDtos.ContractFile(contract.getId(), contract.getGeneratedFileName(), contract.getGeneratedDocx());
    }

    @Transactional
    public HrProbationDtos.CandidateDetail startProbation(
            String candidateId,
            HrProbationDtos.CandidateActionRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        requireVersion(candidate.getRowVersion(), request.rowVersion(), "STALE_PROBATION_CANDIDATE_VERSION",
                "Ứng viên đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        if (candidate.getStatus() == HrProbationCandidateStatus.CONVERTED
                || candidate.getStatus() == HrProbationCandidateStatus.FAILED
                || candidate.getStatus() == HrProbationCandidateStatus.CANCELLED) {
            throw HrApiException.conflict("PROBATION_STATUS_INVALID", "Không thể bắt đầu thử việc ở trạng thái hiện tại.");
        }
        candidate.setStatus(HrProbationCandidateStatus.IN_PROBATION);
        candidate.setStatusReason(trimToNull(request.reason()));
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_STARTED", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("status", "statusReason"), Map.of("status", candidate.getStatus().name()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional
    public HrProbationDtos.CandidateDetail markPassed(
            String candidateId,
            HrProbationDtos.CandidateActionRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        requireVersion(candidate.getRowVersion(), request.rowVersion(), "STALE_PROBATION_CANDIDATE_VERSION",
                "Ứng viên đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        if (candidate.getStatus() == HrProbationCandidateStatus.CONVERTED
                || candidate.getStatus() == HrProbationCandidateStatus.FAILED
                || candidate.getStatus() == HrProbationCandidateStatus.CANCELLED) {
            throw HrApiException.conflict("PROBATION_STATUS_INVALID", "Không thể đánh dấu đạt ở trạng thái hiện tại.");
        }
        candidate.setStatus(HrProbationCandidateStatus.PASSED);
        candidate.setStatusReason(trimToNull(request.reason()));
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_PASSED", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("status", "statusReason"), Map.of("status", candidate.getStatus().name()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional
    public HrProbationDtos.CandidateDetail markFailed(
            String candidateId,
            HrProbationDtos.CandidateActionRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        requireVersion(candidate.getRowVersion(), request.rowVersion(), "STALE_PROBATION_CANDIDATE_VERSION",
                "Ứng viên đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        if (candidate.getStatus() == HrProbationCandidateStatus.CONVERTED) {
            throw HrApiException.conflict("PROBATION_CANDIDATE_CONVERTED",
                    "Ứng viên đã chuyển thành hồ sơ nhân sự.");
        }
        candidate.setStatus(HrProbationCandidateStatus.FAILED);
        candidate.setStatusReason(requiredText(request.reason(), "Vui lòng nhập lý do không đạt thử việc."));
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_FAILED", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("status", "statusReason"), Map.of("status", candidate.getStatus().name()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional
    public HrProbationDtos.CandidateDetail convertToEmployeeDraft(
            String candidateId,
            HrProbationDtos.ConvertToEmployeeDraftRequest request,
            HrImportActor actor
    ) {
        HrProbationCandidate candidate = lockedCandidate(candidateId);
        requireVersion(candidate.getRowVersion(), request.rowVersion(), "STALE_PROBATION_CANDIDATE_VERSION",
                "Ứng viên đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        if (candidate.getStatus() != HrProbationCandidateStatus.PASSED) {
            throw HrApiException.conflict("PROBATION_NOT_PASSED",
                    "Chỉ ứng viên đã đạt thử việc mới được chuyển thành hồ sơ chờ chính thức.");
        }

        String employeeCode = trimToNull(request.employeeCode()) == null
                ? candidate.getCandidateCode()
                : normalizeCode(request.employeeCode());
        LocalDate hireDate = request.hireDate() != null
                ? request.hireDate()
                : candidate.getProbationEndDate() == null ? null : candidate.getProbationEndDate().plusDays(1);

        HrApiDtos.EmployeeDetail employee = managementService.createEmployee(new HrApiDtos.CreateEmployeeRequest(
                new HrApiDtos.PersonalInput(
                        employeeCode,
                        candidate.getFullName(),
                        candidate.getGender(),
                        candidate.getDateOfBirth(),
                        null,
                        null,
                        candidate.getBirthPlace(),
                        candidate.getBirthPlace(),
                        null,
                        null
                ),
                new HrApiDtos.EmploymentInput(
                        id(candidate.getDepartment()),
                        id(candidate.getPosition()),
                        id(candidate.getWorkingCondition()),
                        hireDate,
                        null,
                        null,
                        "Chờ chính thức sau thử việc",
                        latestContractNo(candidate),
                        candidate.getBaseSalary(),
                        null,
                        candidate.getJobDescription()
                ),
                new HrApiDtos.IdentityInput(
                        null,
                        candidate.getCitizenId(),
                        candidate.getCitizenIdIssuedDate(),
                        candidate.getCitizenIdIssuedPlace(),
                        HrIdentityVerificationStatus.UNVERIFIED
                ),
                null,
                new HrApiDtos.ContactInput(
                        candidate.getPermanentAddress(),
                        null,
                        candidate.getPhone(),
                        null,
                        normalizeEmail(candidate.getEmail()),
                        null,
                        null,
                        null
                )
        ), actor);

        HrEmployee employeeRef = employeeRepository.findById(employee.id())
                .orElseThrow(() -> HrApiException.notFound("EMPLOYEE_NOT_FOUND",
                        "Không tìm thấy hồ sơ nhân sự vừa tạo."));
        candidate.setConvertedEmployee(employeeRef);
        candidate.setConvertedAt(LocalDateTime.now(ZoneOffset.UTC));
        candidate.setConvertedByActor(actor.subject());
        candidate.setStatus(HrProbationCandidateStatus.CONVERTED);
        candidate.setStatusReason("Đã chuyển thành hồ sơ chờ chính thức.");
        touch(candidate, actor);
        candidateRepository.save(candidate);
        audit(actor, "HR_PROBATION_CONVERTED_TO_EMPLOYEE_DRAFT", "HR_PROBATION_CANDIDATE", candidate.getId(),
                List.of("status", "convertedEmployeeId"),
                Map.of("employeeId", employee.id(), "employeeCode", employee.personal().employeeCode()));
        return toDetail(candidateRepository.findDetailById(candidate.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public HrPageResponse<HrProbationDtos.JobTemplateSummary> searchJobTemplates(
            HrCatalogStatus status,
            String keyword,
            Pageable pageable
    ) {
        Page<HrProbationDtos.JobTemplateSummary> result = jobTemplateRepository
                .search(status, likePattern(keyword), pageable)
                .map(this::toTemplateSummary);
        return HrPageResponse.from(result, item -> item);
    }

    @Transactional
    public HrProbationDtos.JobTemplateSummary createJobTemplate(
            HrProbationDtos.JobTemplateInput input,
            HrImportActor actor
    ) {
        String code = normalizeCode(input.code());
        String name = requiredText(input.name(), "Tên mẫu công việc là bắt buộc.");
        requireUniqueTemplate(code, name, null);
        validateTemplateInput(input);

        HrProbationJobTemplate template = new HrProbationJobTemplate();
        copyTemplate(template, input);
        template.setCode(code);
        template.setName(name);
        template.setStatus(HrCatalogStatus.ACTIVE);
        setCreatedAudit(template, actor);
        template = jobTemplateRepository.save(template);
        audit(actor, "HR_PROBATION_TEMPLATE_CREATED", "HR_PROBATION_JOB_TEMPLATE", template.getId(),
                List.of("code", "name", "department", "position", "salary"),
                Map.of("status", template.getStatus().name()));
        return toTemplateSummary(template);
    }

    @Transactional
    public HrProbationDtos.JobTemplateSummary updateJobTemplate(
            String templateId,
            HrProbationDtos.UpdateJobTemplateRequest request,
            HrImportActor actor
    ) {
        HrProbationJobTemplate template = jobTemplateRepository.findById(templateId)
                .orElseThrow(() -> HrApiException.notFound("PROBATION_TEMPLATE_NOT_FOUND",
                        "Không tìm thấy mẫu công việc thử việc."));
        requireVersion(template.getRowVersion(), request.rowVersion(), "STALE_PROBATION_TEMPLATE_VERSION",
                "Mẫu công việc đã được cập nhật ở nơi khác. Vui lòng tải lại.");
        String code = normalizeCode(request.template().code());
        String name = requiredText(request.template().name(), "Tên mẫu công việc là bắt buộc.");
        requireUniqueTemplate(code, name, templateId);
        validateTemplateInput(request.template());

        copyTemplate(template, request.template());
        template.setCode(code);
        template.setName(name);
        if (request.status() != null) {
            template.setStatus(request.status());
        }
        touch(template, actor);
        template = jobTemplateRepository.save(template);
        audit(actor, "HR_PROBATION_TEMPLATE_UPDATED", "HR_PROBATION_JOB_TEMPLATE", template.getId(),
                List.of("code", "name", "department", "position", "salary", "status"),
                Map.of("status", template.getStatus().name()));
        return toTemplateSummary(template);
    }

    private void validateCandidateInput(HrProbationDtos.CandidateInput input) {
        if (input == null) {
            throw HrApiException.badRequest("PROBATION_CANDIDATE_REQUIRED", "Thông tin ứng viên là bắt buộc.");
        }
        if (input.dateOfBirth() != null && input.dateOfBirth().isAfter(LocalDate.now(ZoneOffset.UTC))) {
            throw HrApiException.badRequest("DATE_OF_BIRTH_IN_FUTURE", "Ngày sinh không được nằm trong tương lai.");
        }
        if (input.probationStartDate() != null && input.probationEndDate() != null
                && input.probationEndDate().isBefore(input.probationStartDate())) {
            throw HrApiException.badRequest("INVALID_PROBATION_DATES",
                    "Ngày kết thúc thử việc không được trước ngày bắt đầu.");
        }
    }

    private void validateTemplateInput(HrProbationDtos.JobTemplateInput input) {
        if (input == null) {
            throw HrApiException.badRequest("PROBATION_TEMPLATE_REQUIRED", "Thông tin mẫu công việc là bắt buộc.");
        }
    }

    private void copyCandidate(
            HrProbationCandidate candidate,
            HrProbationDtos.CandidateInput input,
            HrImportActor actor,
            boolean created
    ) {
        String code = trimToNull(input.candidateCode()) == null
                ? nextCandidateCode()
                : normalizeCode(input.candidateCode());
        requireUniqueCandidateCode(code, created ? null : candidate.getId());
        candidate.setCandidateCode(code);
        candidate.setFullName(requiredText(input.fullName(), "Họ tên ứng viên là bắt buộc."));
        candidate.setGender(input.gender() == null ? HrEmployeeGender.UNKNOWN : input.gender());
        candidate.setCandidateTitle(trimToNull(input.candidateTitle()) == null
                ? titleFromGender(candidate.getGender())
                : trimToNull(input.candidateTitle()));
        candidate.setDateOfBirth(input.dateOfBirth());
        candidate.setBirthPlace(trimToNull(input.birthPlace()));
        candidate.setNationality(trimToNull(input.nationality()) == null ? "Việt Nam" : trimToNull(input.nationality()));
        candidate.setCitizenId(trimToNull(input.citizenId()));
        candidate.setCitizenIdIssuedDate(input.citizenIdIssuedDate());
        candidate.setCitizenIdIssuedPlace(trimToNull(input.citizenIdIssuedPlace()));
        candidate.setPermanentAddress(trimToNull(input.permanentAddress()));
        candidate.setPhone(trimToNull(input.phone()));
        candidate.setEmail(normalizeEmail(input.email()));
        candidate.setDepartment(catalogById(departmentRepository, input.departmentId(), "Không tìm thấy phòng ban HR."));
        candidate.setPosition(catalogById(positionRepository, input.positionId(), "Không tìm thấy chức vụ HR."));
        candidate.setWorkingCondition(catalogById(workingConditionRepository, input.workingConditionId(),
                "Không tìm thấy điều kiện lao động."));
        candidate.setJobTemplate(resolveJobTemplate(input.jobTemplateId()));
        candidate.setProbationContractType(trimToNull(input.probationContractType()) == null
                ? "Xác định thời hạn 02 tháng"
                : trimToNull(input.probationContractType()));
        candidate.setProbationStartDate(input.probationStartDate());
        candidate.setProbationEndDate(input.probationEndDate());
        candidate.setBaseSalary(input.baseSalary());
        candidate.setSalaryNote(trimToNull(input.salaryNote()));
        candidate.setJobDescription(trimToNull(input.jobDescription()));
        candidate.setDepartmentRuleNote(trimToNull(input.departmentRuleNote()));
        if (!created) {
            touch(candidate, actor);
        }
    }

    private void copyTemplate(HrProbationJobTemplate template, HrProbationDtos.JobTemplateInput input) {
        template.setDescription(trimToNull(input.description()));
        template.setDepartment(catalogById(departmentRepository, input.departmentId(), "Không tìm thấy phòng ban HR."));
        template.setPosition(catalogById(positionRepository, input.positionId(), "Không tìm thấy chức vụ HR."));
        template.setWorkingCondition(catalogById(workingConditionRepository, input.workingConditionId(),
                "Không tìm thấy điều kiện lao động."));
        template.setProbationContractType(trimToNull(input.probationContractType()));
        template.setJobDescription(trimToNull(input.jobDescription()));
        template.setBaseSalary(input.baseSalary());
        template.setSalaryNote(trimToNull(input.salaryNote()));
        template.setDepartmentRuleNote(trimToNull(input.departmentRuleNote()));
        template.setSortOrder(input.sortOrder() == null ? 0 : input.sortOrder());
    }

    private HrProbationCandidate requireCandidate(String id) {
        return candidateRepository.findDetailById(requiredText(id, "Mã ứng viên là bắt buộc."))
                .orElseThrow(() -> HrApiException.notFound("PROBATION_CANDIDATE_NOT_FOUND",
                        "Không tìm thấy ứng viên thử việc."));
    }

    private HrProbationCandidate lockedCandidate(String id) {
        return candidateRepository.findDetailByIdForUpdate(requiredText(id, "Mã ứng viên là bắt buộc."))
                .orElseThrow(() -> HrApiException.notFound("PROBATION_CANDIDATE_NOT_FOUND",
                        "Không tìm thấy ứng viên thử việc."));
    }

    private HrProbationJobTemplate resolveJobTemplate(String id) {
        String normalized = blankToNull(id);
        if (normalized == null) return null;
        return jobTemplateRepository.findById(normalized)
                .orElseThrow(() -> HrApiException.notFound("PROBATION_TEMPLATE_NOT_FOUND",
                        "Không tìm thấy mẫu công việc thử việc."));
    }

    private void requireUniqueCandidateCode(String code, String currentId) {
        candidateRepository.findByCandidateCode(code).ifPresent(existing -> {
            if (!Objects.equals(existing.getId(), currentId)) {
                throw HrApiException.conflict("PROBATION_CANDIDATE_CODE_EXISTS",
                        "Mã ứng viên thử việc đã tồn tại.");
            }
        });
    }

    private void requireUniqueTemplate(String code, String name, String currentId) {
        HrProbationJobTemplate byCode = jobTemplateRepository.findByCode(code).orElse(null);
        HrProbationJobTemplate byName = jobTemplateRepository.findByName(name).orElse(null);
        if ((byCode != null && !Objects.equals(byCode.getId(), currentId))
                || (byName != null && !Objects.equals(byName.getId(), currentId))) {
            throw HrApiException.conflict("PROBATION_TEMPLATE_DUPLICATE",
                    "Mã hoặc tên mẫu công việc đã tồn tại.");
        }
    }

    private void validateContractRequiredFields(HrProbationCandidate candidate) {
        Map<String, String> missing = new HashMap<>();
        requireForContract(candidate.getFullName(), "Họ tên", missing);
        requireForContract(candidate.getDateOfBirth(), "Ngày sinh", missing);
        requireForContract(candidate.getBirthPlace(), "Nơi sinh", missing);
        requireForContract(candidate.getPermanentAddress(), "Địa chỉ thường trú", missing);
        requireForContract(candidate.getCitizenId(), "Số CCCD", missing);
        requireForContract(candidate.getCitizenIdIssuedDate(), "Ngày cấp CCCD", missing);
        requireForContract(candidate.getCitizenIdIssuedPlace(), "Nơi cấp CCCD", missing);
        requireForContract(candidate.getProbationStartDate(), "Ngày bắt đầu thử việc", missing);
        requireForContract(candidate.getProbationEndDate(), "Ngày kết thúc thử việc", missing);
        requireForContract(candidate.getJobDescription(), "Công việc phải làm", missing);
        requireForContract(candidate.getBaseSalary(), "Lương thử việc", missing);
        if (!missing.isEmpty()) {
            throw HrApiException.badRequest("PROBATION_CONTRACT_MISSING_FIELDS",
                    "Vui lòng bổ sung thông tin trước khi tạo hợp đồng: " + String.join(", ", missing.values()) + ".");
        }
    }

    private static void requireForContract(Object value, String label, Map<String, String> missing) {
        if (value == null || value instanceof String text && text.isBlank()) {
            missing.put(label, label);
        }
    }

    private String resolveContractNo(String requested, short year) {
        String normalized = trimToNull(requested);
        if (normalized != null) {
            if (contractRepository.existsByContractNoAndContractYear(normalized, year)) {
                throw HrApiException.conflict("PROBATION_CONTRACT_NO_EXISTS",
                        "Số hợp đồng thử việc trong năm này đã tồn tại.");
            }
            return normalized;
        }
        long next = contractRepository.countByContractYear(year) + 1;
        String value = "%02d".formatted(next);
        while (contractRepository.existsByContractNoAndContractYear(value, year)) {
            next += 1;
            value = "%02d".formatted(next);
        }
        return value;
    }

    private Map<String, String> contractPlaceholders(
            HrProbationCandidate candidate,
            LocalDate signDate,
            String contractNo,
            short contractYear
    ) {
        return Map.ofEntries(
                Map.entry("{{CONTRACT_NO}}", contractNo),
                Map.entry("{{CONTRACT_YEAR}}", Short.toString(contractYear)),
                Map.entry("{{SIGN_DAY}}", "%02d".formatted(signDate.getDayOfMonth())),
                Map.entry("{{SIGN_MONTH}}", "%02d".formatted(signDate.getMonthValue())),
                Map.entry("{{SIGN_YEAR}}", Integer.toString(signDate.getYear())),
                Map.entry("{{CANDIDATE_TITLE}}", text(candidate.getCandidateTitle(), titleFromGender(candidate.getGender()))),
                Map.entry("{{FULL_NAME}}", text(candidate.getFullName(), "")),
                Map.entry("{{NATIONALITY}}", text(candidate.getNationality(), "Việt Nam")),
                Map.entry("{{DATE_OF_BIRTH}}", date(candidate.getDateOfBirth())),
                Map.entry("{{BIRTH_PLACE}}", text(candidate.getBirthPlace(), "")),
                Map.entry("{{PERMANENT_ADDRESS}}", text(candidate.getPermanentAddress(), "")),
                Map.entry("{{CITIZEN_ID}}", text(candidate.getCitizenId(), "")),
                Map.entry("{{CITIZEN_ID_ISSUED_DATE}}", date(candidate.getCitizenIdIssuedDate())),
                Map.entry("{{CITIZEN_ID_ISSUED_PLACE}}", text(candidate.getCitizenIdIssuedPlace(), "")),
                Map.entry("{{PROBATION_CONTRACT_TYPE}}", text(candidate.getProbationContractType(), "Xác định thời hạn 02 tháng")),
                Map.entry("{{PROBATION_START_DATE}}", date(candidate.getProbationStartDate())),
                Map.entry("{{PROBATION_END_DATE}}", date(candidate.getProbationEndDate())),
                Map.entry("{{POSITION_NAME}}", text(name(candidate.getPosition()), templateName(candidate.getJobTemplate(), "Nhân viên thử việc"))),
                Map.entry("{{JOB_DESCRIPTION}}", text(candidate.getJobDescription(), "")),
                Map.entry("{{BASE_SALARY_TEXT}}", salary(candidate.getBaseSalary())),
                Map.entry("{{SALARY_NOTE}}", salaryNote(candidate.getSalaryNote())),
                Map.entry("{{DEPARTMENT_RULE_NOTE}}", text(candidate.getDepartmentRuleNote(), ""))
        );
    }

    private byte[] readTemplateBytes() {
        try (InputStream input = HrProbationService.class.getResourceAsStream(TEMPLATE_PATH)) {
            if (input == null) {
                throw HrApiException.badRequest("PROBATION_CONTRACT_TEMPLATE_MISSING",
                        "Không tìm thấy file mẫu hợp đồng thử việc trong backend resources.");
            }
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc template hợp đồng thử việc.", exception);
        }
    }

    private byte[] fillDocxTemplate(byte[] template, Map<String, String> placeholders) {
        try (
                ZipInputStream zipInput = new ZipInputStream(new ByteArrayInputStream(template));
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                ZipOutputStream zipOutput = new ZipOutputStream(output)
        ) {
            ZipEntry entry;
            while ((entry = zipInput.getNextEntry()) != null) {
                ZipEntry copied = new ZipEntry(entry.getName());
                zipOutput.putNextEntry(copied);
                byte[] data = zipInput.readAllBytes();
                if ("word/document.xml".equals(entry.getName())) {
                    String xml = new String(data, java.nio.charset.StandardCharsets.UTF_8);
                    for (Map.Entry<String, String> placeholder : placeholders.entrySet()) {
                        xml = xml.replace(placeholder.getKey(), escapeXml(placeholder.getValue()));
                    }
                    data = xml.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                }
                zipOutput.write(data);
                zipOutput.closeEntry();
            }
            zipOutput.finish();
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể sinh hợp đồng thử việc.", exception);
        }
    }

    private String latestContractNo(HrProbationCandidate candidate) {
        return contractRepository.findLatestByCandidateId(candidate.getId(), PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(contract -> contract.getContractNo() + "/HĐTV-PBHC-" + contract.getContractYear())
                .orElse(null);
    }

    private HrProbationDtos.CandidateSummary toSummary(HrProbationCandidate candidate) {
        return new HrProbationDtos.CandidateSummary(
                candidate.getId(),
                candidate.getCandidateCode(),
                candidate.getFullName(),
                candidate.getGender(),
                candidate.getDateOfBirth(),
                candidate.getPhone(),
                ref(candidate.getDepartment()),
                ref(candidate.getPosition()),
                candidate.getStatus(),
                candidate.getProbationStartDate(),
                candidate.getProbationEndDate(),
                latestContract(candidate),
                id(candidate.getConvertedEmployee()),
                candidate.getRowVersion(),
                candidate.getUpdatedAt()
        );
    }

    private HrProbationDtos.CandidateDetail toDetail(HrProbationCandidate candidate) {
        HrEmployee converted = candidate.getConvertedEmployee();
        return new HrProbationDtos.CandidateDetail(
                candidate.getId(),
                candidate.getCandidateCode(),
                candidate.getFullName(),
                candidate.getCandidateTitle(),
                candidate.getGender(),
                candidate.getDateOfBirth(),
                candidate.getBirthPlace(),
                candidate.getNationality(),
                candidate.getCitizenId(),
                candidate.getCitizenIdIssuedDate(),
                candidate.getCitizenIdIssuedPlace(),
                candidate.getPermanentAddress(),
                candidate.getPhone(),
                candidate.getEmail(),
                ref(candidate.getDepartment()),
                ref(candidate.getPosition()),
                ref(candidate.getWorkingCondition()),
                candidate.getJobTemplate() == null ? null : toTemplateSummary(candidate.getJobTemplate()),
                candidate.getProbationContractType(),
                candidate.getProbationStartDate(),
                candidate.getProbationEndDate(),
                candidate.getBaseSalary(),
                candidate.getSalaryNote(),
                candidate.getJobDescription(),
                candidate.getDepartmentRuleNote(),
                candidate.getStatus(),
                candidate.getStatusReason(),
                latestContract(candidate),
                id(converted),
                converted == null ? null : converted.getEmployeeCode(),
                candidate.getConvertedAt(),
                candidate.getRowVersion(),
                candidate.getCreatedAt(),
                candidate.getUpdatedAt()
        );
    }

    private HrProbationDtos.ContractSummary latestContract(HrProbationCandidate candidate) {
        return contractRepository.findLatestByCandidateId(candidate.getId(), PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(this::toContractSummary)
                .orElse(null);
    }

    private HrProbationDtos.ContractSummary toContractSummary(HrProbationContract contract) {
        return new HrProbationDtos.ContractSummary(
                contract.getId(),
                contract.getContractNo(),
                contract.getContractYear(),
                contract.getGeneratedFileName(),
                contract.getGeneratedFileSha256(),
                contract.getStatus(),
                contract.getGeneratedAt(),
                contract.getGeneratedByActor()
        );
    }

    private HrProbationDtos.JobTemplateSummary toTemplateSummary(HrProbationJobTemplate template) {
        return new HrProbationDtos.JobTemplateSummary(
                template.getId(),
                template.getCode(),
                template.getName(),
                template.getDescription(),
                ref(template.getDepartment()),
                ref(template.getPosition()),
                ref(template.getWorkingCondition()),
                template.getProbationContractType(),
                template.getBaseSalary(),
                template.getSalaryNote(),
                template.getJobDescription(),
                template.getDepartmentRuleNote(),
                template.getStatus(),
                template.getSortOrder(),
                template.getRowVersion()
        );
    }

    private <T extends HrCatalogEntity> T catalogById(HrRepository<T, String> repository, String id, String message) {
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

    private String nextCandidateCode() {
        String base = "TV-" + CODE_TIME_FORMAT.format(LocalDateTime.now(ZoneOffset.UTC));
        String value = base;
        int attempt = 1;
        while (candidateRepository.findByCandidateCode(value).isPresent()) {
            attempt += 1;
            value = base + "-" + attempt;
        }
        return value;
    }

    private static void setCreatedAudit(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setCreatedByActor(actor.subject());
        entity.setUpdatedByActor(actor.subject());
    }

    private static void touch(com.booking.system.hr.entity.HrAuditable entity, HrImportActor actor) {
        entity.setUpdatedByActor(actor.subject());
        entity.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
    }

    private static void requireVersion(long current, Long requested, String code, String message) {
        if (requested == null || current != requested) {
            throw HrApiException.conflict(code, message);
        }
    }

    private static String likePattern(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : "%" + normalized.toLowerCase(Locale.ROOT) + "%";
    }

    private static String normalizeCode(String value) {
        return requiredText(value, "Mã là bắt buộc.").toUpperCase(Locale.ROOT);
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

    private static HrApiDtos.CatalogRef ref(HrCatalogEntity entity) {
        return entity == null ? null : new HrApiDtos.CatalogRef(entity.getId(), entity.getCode(), entity.getName());
    }

    private static String id(HrCatalogEntity value) {
        return value == null ? null : value.getId();
    }

    private static String id(HrEmployee value) {
        return value == null ? null : value.getId();
    }

    private static String name(HrCatalogEntity value) {
        return value == null ? null : value.getName();
    }

    private static String templateName(HrProbationJobTemplate value, String fallback) {
        return value == null ? fallback : text(value.getName(), fallback);
    }

    private static String titleFromGender(HrEmployeeGender gender) {
        return gender == HrEmployeeGender.FEMALE ? "Bà" : gender == HrEmployeeGender.MALE ? "Ông" : "Ông/Bà";
    }

    private static String text(String value, String fallback) {
        String normalized = trimToNull(value);
        return normalized == null ? fallback : normalized;
    }

    private static String date(LocalDate value) {
        return value == null ? "" : DATE_FORMAT.format(value);
    }

    private static String salary(BigDecimal value) {
        if (value == null) return "";
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.US);
        DecimalFormat format = new DecimalFormat("#,###", symbols);
        return format.format(value).replace(',', '.');
    }

    private static String salaryNote(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) return "";
        return normalized.startsWith(" ") ? normalized : " " + normalized;
    }

    private static String contractFileName(HrProbationCandidate candidate, String contractNo, short year) {
        return "HDTV-" + contractNo + "-" + year + "-" + slug(candidate.getFullName()) + ".docx";
    }

    private static String slug(String value) {
        String source = trimToNull(value);
        if (source == null) return "ung-vien";
        String normalized = Normalizer.normalize(source, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('Đ', 'D')
                .replace('đ', 'd');
        String slug = NON_FILE_NAME.matcher(normalized.trim()).replaceAll("-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "")
                .toLowerCase(Locale.ROOT);
        return slug.isBlank() ? "ung-vien" : slug;
    }

    private static String escapeXml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String sha256(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 không khả dụng.", exception);
        }
    }
}

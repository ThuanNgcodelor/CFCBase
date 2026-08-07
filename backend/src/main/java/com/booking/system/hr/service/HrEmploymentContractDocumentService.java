package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrEmploymentContractDtos;
import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.entity.HrEmployeeContact;
import com.booking.system.hr.entity.HrEmployeeEmployment;
import com.booking.system.hr.entity.HrEmployeeIdentity;
import com.booking.system.hr.entity.HrEmploymentContract;
import com.booking.system.hr.entity.HrEmploymentContractDocument;
import com.booking.system.hr.entity.HrProbationCandidate;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrEmploymentContractStatus;
import com.booking.system.hr.enums.HrEmploymentContractType;
import com.booking.system.hr.enums.HrWorkforceGroup;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmploymentContractDocumentRepository;
import com.booking.system.hr.repository.HrEmploymentContractRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class HrEmploymentContractDocumentService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Pattern NON_FILE_NAME = Pattern.compile("[^a-zA-Z0-9._-]+");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{[A-Z0-9_]+}}");
    private static final Pattern XML_TAG = Pattern.compile("<[^>]+>");

    private final HrEmploymentContractRepository contractRepository;
    private final HrEmploymentContractDocumentRepository documentRepository;
    private final HrEmploymentContractTemplateProvider templateProvider;
    private final HrAuditEventRepository auditRepository;
    private final HrImportJsonCodec jsonCodec;

    @Transactional
    public HrEmploymentContractDtos.DocumentSummary generate(String contractId, HrImportActor actor) {
        HrEmploymentContract contract = contractRepository.findDocumentSourceByIdForUpdate(contractId)
                .orElseThrow(() -> HrApiException.notFound(
                        "EMPLOYMENT_CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng lao động."
                ));
        if (contract.getStatus() == HrEmploymentContractStatus.VOIDED) {
            throw HrApiException.conflict(
                    "EMPLOYMENT_CONTRACT_VOIDED",
                    "Hợp đồng lao động đã hủy nên không thể xuất file."
            );
        }

        HrEmployee employee = contract.getEmployee();
        HrWorkforceGroup workforceGroup = employee.getWorkforceGroup();
        HrEmploymentContractTemplateProvider.TemplateSource template = templateProvider.load(workforceGroup);
        Map<String, String> placeholders = placeholders(contract);
        byte[] generated = fillDocxTemplate(template.bytes(), placeholders);

        HrEmploymentContractDocument document = new HrEmploymentContractDocument();
        document.setEmploymentContract(contract);
        document.setWorkforceGroup(workforceGroup);
        document.setTemplateFileName(template.fileName());
        document.setTemplateSha256(sha256(template.bytes()));
        document.setGeneratedFileName(generatedFileName(contract));
        document.setGeneratedFileSha256(sha256(generated));
        document.setGeneratedDocx(generated);
        try {
            document.setSnapshotPayload(jsonCodec.write(placeholders));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi snapshot hợp đồng lao động.", exception);
        }
        document.setGeneratedAt(LocalDateTime.now(ZoneOffset.UTC));
        document.setGeneratedByActor(actor.subject());
        setCreatedAudit(document, actor);
        document = documentRepository.save(document);

        audit(actor, document, employee);
        return toSummary(document);
    }

    @Transactional(readOnly = true)
    public HrEmploymentContractDtos.DocumentFile download(String documentId) {
        HrEmploymentContractDocument document = documentRepository.findDetailById(documentId)
                .orElseThrow(() -> HrApiException.notFound(
                        "EMPLOYMENT_CONTRACT_DOCUMENT_NOT_FOUND",
                        "Không tìm thấy file hợp đồng lao động."
                ));
        return new HrEmploymentContractDtos.DocumentFile(
                document.getId(),
                document.getGeneratedFileName(),
                document.getGeneratedDocx()
        );
    }

    private HrEmploymentContractDtos.DocumentSummary toSummary(HrEmploymentContractDocument document) {
        return new HrEmploymentContractDtos.DocumentSummary(
                document.getId(),
                document.getEmploymentContract().getId(),
                document.getWorkforceGroup(),
                document.getTemplateFileName(),
                document.getTemplateSha256(),
                document.getGeneratedFileName(),
                document.getGeneratedFileSha256(),
                document.getGeneratedAt(),
                document.getGeneratedByActor()
        );
    }

    private Map<String, String> placeholders(HrEmploymentContract contract) {
        HrEmployee employee = contract.getEmployee();
        HrEmployeeEmployment employment = employee.getEmployment();
        HrEmployeeIdentity identity = employee.getIdentity();
        HrEmployeeContact contact = employee.getContact();
        HrProbationCandidate candidate = contract.getSourceProbationCandidate();
        HrWorkforceGroup workforceGroup = employee.getWorkforceGroup();

        String departmentName = employment == null || employment.getDepartment() == null
                ? ""
                : text(employment.getDepartment().getName());
        String positionName = employment == null || employment.getPosition() == null
                ? ""
                : text(employment.getPosition().getName());
        String workplace = workforceGroup == HrWorkforceGroup.OFFICE && !departmentName.isBlank()
                ? departmentName
                : "Tại Công ty";
        BigDecimal baseSalary = employment == null ? null : employment.getBaseSalary();
        if (baseSalary == null && candidate != null) {
            baseSalary = candidate.getBaseSalary();
        }
        validateRequiredDocumentData(employee, employment, identity, contact, candidate, baseSalary,
                departmentName, positionName);

        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        values.put("{{CONTRACT_NUMBER}}", text(contract.getContractNumber()));
        values.put("{{CONTRACT_YEAR}}", Integer.toString(contract.getSignDate().getYear()));
        values.put("{{SIGN_DAY}}", "%02d".formatted(contract.getSignDate().getDayOfMonth()));
        values.put("{{SIGN_MONTH}}", "%02d".formatted(contract.getSignDate().getMonthValue()));
        values.put("{{SIGN_YEAR}}", Integer.toString(contract.getSignDate().getYear()));
        values.put("{{EMPLOYEE_TITLE}}", employeeTitle(employee.getGender(), candidate));
        values.put("{{FULL_NAME}}", text(employee.getFullName()));
        values.put("{{NATIONALITY}}", firstText(candidate == null ? null : candidate.getNationality(), "Việt Nam"));
        values.put("{{DATE_OF_BIRTH}}", date(employee.getDateOfBirth()));
        values.put("{{BIRTH_PLACE}}", firstText(
                employee.getBirthPlaceCurrent(),
                employee.getBirthPlaceOriginal(),
                candidate == null ? null : candidate.getBirthPlace()
        ));
        values.put("{{PERMANENT_ADDRESS}}", firstText(
                contact == null ? null : contact.getPermanentAddress(),
                candidate == null ? null : candidate.getPermanentAddress()
        ));
        values.put("{{CITIZEN_ID}}", firstText(
                identity == null ? null : identity.getCitizenIdentityNumber(),
                candidate == null ? null : candidate.getCitizenId(),
                identity == null ? null : identity.getLegacyIdentityNumber()
        ));
        values.put("{{CITIZEN_ID_ISSUED_DATE}}", date(firstDate(
                identity == null ? null : identity.getIssuedDate(),
                candidate == null ? null : candidate.getCitizenIdIssuedDate()
        )));
        values.put("{{CITIZEN_ID_ISSUED_PLACE}}", firstText(
                identity == null ? null : identity.getIssuedPlace(),
                candidate == null ? null : candidate.getCitizenIdIssuedPlace()
        ));
        values.put("{{CONTRACT_TYPE}}", contractType(contract.getContractType()));
        values.put("{{CONTRACT_START_DATE}}", date(contract.getEffectiveFrom()));
        values.put("{{CONTRACT_END_DATE}}", date(contract.getEffectiveUntil()));
        values.put("{{CONTRACT_PERIOD}}", contractPeriod(contract));
        values.put("{{DEPARTMENT_NAME}}", departmentName);
        values.put("{{POSITION_NAME}}", positionName);
        values.put("{{JOB_DESCRIPTION}}", singleLine(firstText(
                employment == null ? null : employment.getJobDescription(),
                candidate == null ? null : candidate.getJobDescription()
        )));
        values.put("{{WORKPLACE}}", workplace);
        values.put("{{BASE_SALARY_TEXT}}", salary(baseSalary));
        values.put("{{ALLOWANCE_TEXT}}", salary(employment == null ? null : employment.getAllowance()));
        values.put("{{SALARY_NOTE}}", singleLine(candidate == null ? null : text(candidate.getSalaryNote())));
        values.put("{{DEPARTMENT_RULE_NOTE}}", singleLine(
                candidate == null ? null : text(candidate.getDepartmentRuleNote())));
        values.put("{{WORKFORCE_GROUP}}", workforceGroupLabel(workforceGroup));
        return values;
    }

    private byte[] fillDocxTemplate(byte[] template, Map<String, String> placeholders) {
        Set<String> unresolved = new LinkedHashSet<>();
        boolean documentXmlFound = false;
        int replacementCount = 0;
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
                if (entry.getName().startsWith("word/") && entry.getName().endsWith(".xml")) {
                    if ("word/document.xml".equals(entry.getName())) {
                        documentXmlFound = true;
                    }
                    String xml = new String(data, StandardCharsets.UTF_8);
                    for (Map.Entry<String, String> placeholder : placeholders.entrySet()) {
                        if (xml.contains(placeholder.getKey())) {
                            replacementCount++;
                            xml = xml.replace(placeholder.getKey(), escapeXml(placeholder.getValue()));
                        }
                    }
                    Matcher matcher = PLACEHOLDER.matcher(XML_TAG.matcher(xml).replaceAll(""));
                    while (matcher.find()) {
                        unresolved.add(matcher.group());
                    }
                    data = xml.getBytes(StandardCharsets.UTF_8);
                }
                zipOutput.write(data);
                zipOutput.closeEntry();
            }
            zipOutput.finish();
            if (!documentXmlFound) {
                throw new IllegalStateException("Mẫu hợp đồng lao động không có word/document.xml.");
            }
            if (replacementCount == 0) {
                throw new IllegalStateException("Mẫu hợp đồng lao động không chứa placeholder được hỗ trợ.");
            }
            if (!unresolved.isEmpty()) {
                throw new IllegalStateException(
                        "Mẫu hợp đồng lao động còn placeholder chưa xử lý: " + String.join(", ", unresolved));
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể sinh file hợp đồng lao động.", exception);
        }
    }

    private void audit(
            HrImportActor actor,
            HrEmploymentContractDocument document,
            HrEmployee employee
    ) {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject(actor.subject());
        event.setActorDisplayName(actor.displayName());
        event.setActorRole(actor.role());
        event.setAction("HR_EMPLOYMENT_CONTRACT_DOCUMENT_GENERATED");
        event.setEntityType("HR_EMPLOYMENT_CONTRACT_DOCUMENT");
        event.setEntityId(document.getId());
        try {
            event.setChangedFields(jsonCodec.write(List.of(
                    "templateFileName", "templateSha256", "generatedFileName", "generatedFileSha256"
            )));
            event.setSanitizedMetadata(jsonCodec.write(Map.of(
                    "employmentContractId", document.getEmploymentContract().getId(),
                    "employeeId", employee.getId(),
                    "workforceGroup", document.getWorkforceGroup().name()
            )));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể ghi audit file hợp đồng lao động.", exception);
        }
        auditRepository.save(event);
    }

    private static String generatedFileName(HrEmploymentContract contract) {
        String employeeCode = safeFilePart(contract.getEmployee().getEmployeeCode(), "employee");
        String contractNumber = safeFilePart(contract.getContractNumber(), "contract");
        return "employment-contract-" + employeeCode + "-" + contractNumber + ".docx";
    }

    private static String safeFilePart(String value, String fallback) {
        String normalized = NON_FILE_NAME.matcher(text(value)).replaceAll("-")
                .replaceAll("-+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? fallback : normalized;
    }

    private static String employeeTitle(HrEmployeeGender gender, HrProbationCandidate candidate) {
        String candidateTitle = candidate == null ? null : trimToNull(candidate.getCandidateTitle());
        if (candidateTitle != null) {
            return candidateTitle;
        }
        if (gender == HrEmployeeGender.MALE) return "Ông";
        if (gender == HrEmployeeGender.FEMALE) return "Bà";
        return "Ông/Bà";
    }

    private static String contractType(HrEmploymentContractType type) {
        return type == HrEmploymentContractType.INDEFINITE
                ? "Không xác định thời hạn"
                : "Xác định thời hạn 12 tháng";
    }

    private static String contractPeriod(HrEmploymentContract contract) {
        if (contract.getContractType() == HrEmploymentContractType.INDEFINITE) {
            return "Từ ngày: " + date(contract.getEffectiveFrom()) + ".";
        }
        return "Từ ngày: " + date(contract.getEffectiveFrom())
                + " đến " + date(contract.getEffectiveUntil()) + ".";
    }

    private static String workforceGroupLabel(HrWorkforceGroup workforceGroup) {
        return workforceGroup == HrWorkforceGroup.OFFICE
                ? "Khối văn phòng"
                : "Khối lao động phổ thông";
    }

    private static String salary(BigDecimal value) {
        if (value == null) return "Không có";
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.US);
        DecimalFormat format = new DecimalFormat("#,###.##", symbols);
        return format.format(value).replace(',', '.') + " đồng";
    }

    private static void validateRequiredDocumentData(
            HrEmployee employee,
            HrEmployeeEmployment employment,
            HrEmployeeIdentity identity,
            HrEmployeeContact contact,
            HrProbationCandidate candidate,
            BigDecimal baseSalary,
            String departmentName,
            String positionName
    ) {
        List<String> missing = new ArrayList<>();
        require(missing, employee.getFullName(), "họ tên");
        if (employee.getDateOfBirth() == null) missing.add("ngày sinh");
        require(missing, firstText(employee.getBirthPlaceCurrent(), employee.getBirthPlaceOriginal(),
                candidate == null ? null : candidate.getBirthPlace()), "nơi sinh");
        require(missing, firstText(contact == null ? null : contact.getPermanentAddress(),
                candidate == null ? null : candidate.getPermanentAddress()), "địa chỉ thường trú");
        require(missing, firstText(identity == null ? null : identity.getCitizenIdentityNumber(),
                candidate == null ? null : candidate.getCitizenId(),
                identity == null ? null : identity.getLegacyIdentityNumber()), "số CCCD/CMND");
        if (firstDate(identity == null ? null : identity.getIssuedDate(),
                candidate == null ? null : candidate.getCitizenIdIssuedDate()) == null) {
            missing.add("ngày cấp CCCD");
        }
        require(missing, firstText(identity == null ? null : identity.getIssuedPlace(),
                candidate == null ? null : candidate.getCitizenIdIssuedPlace()), "nơi cấp CCCD");
        require(missing, departmentName, "phòng ban");
        require(missing, positionName, "chức vụ");
        require(missing, firstText(employment == null ? null : employment.getJobDescription(),
                candidate == null ? null : candidate.getJobDescription()), "mô tả công việc");
        if (baseSalary == null) missing.add("lương cơ bản");

        if (!missing.isEmpty()) {
            throw HrApiException.badRequest(
                    "EMPLOYMENT_CONTRACT_DOCUMENT_DATA_INCOMPLETE",
                    "Chưa đủ dữ liệu để xuất hợp đồng lao động: " + String.join(", ", missing) + "."
            );
        }
    }

    private static void require(List<String> missing, String value, String label) {
        if (trimToNull(value) == null) missing.add(label);
    }

    private static String date(LocalDate value) {
        return value == null ? "" : DATE_FORMAT.format(value);
    }

    private static LocalDate firstDate(LocalDate first, LocalDate second) {
        return first == null ? second : first;
    }

    private static String firstText(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return "";
    }

    private static String text(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? "" : normalized;
    }

    private static String singleLine(String value) {
        String normalized = text(value)
                .replace("\r\n", "; ")
                .replace('\r', ';')
                .replace('\n', ';');
        return normalized.replaceAll("\\s*;\\s*", "; ").trim();
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 không khả dụng.", exception);
        }
    }

    private static void setCreatedAudit(HrEmploymentContractDocument document, HrImportActor actor) {
        document.setCreatedByActor(actor.subject());
        document.setUpdatedByActor(actor.subject());
    }
}

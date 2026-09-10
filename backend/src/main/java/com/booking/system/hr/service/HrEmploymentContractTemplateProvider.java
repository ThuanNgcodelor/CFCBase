package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.enums.HrWorkforceGroup;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

@Component
public class HrEmploymentContractTemplateProvider {
    private final HrDocumentTemplateService managedTemplates;

    private static final String TEMPLATE_DIRECTORY = "/hr/templates/";
    private static final String OFFICE_TEMPLATE = "employment-contract-office-template.docx";
    private static final String GENERAL_LABOR_TEMPLATE = "employment-contract-general-labor-template.docx";

    HrEmploymentContractTemplateProvider(HrDocumentTemplateService managedTemplates) {
        this.managedTemplates = managedTemplates;
    }

    public TemplateSource load(HrWorkforceGroup workforceGroup) {
        if (managedTemplates != null && workforceGroup != HrWorkforceGroup.LEGACY_UNKNOWN) {
            var file = managedTemplates.active(workforceGroup.name());
            return new TemplateSource(file.fileName(), file.bytes());
        }
        String fileName = switch (workforceGroup) {
            case OFFICE -> OFFICE_TEMPLATE;
            case GENERAL_LABOR -> GENERAL_LABOR_TEMPLATE;
            case LEGACY_UNKNOWN -> throw HrApiException.conflict(
                    "EMPLOYMENT_CONTRACT_WORKFORCE_GROUP_UNSUPPORTED",
                    "Chỉ khối văn phòng và khối lao động phổ thông được xuất hợp đồng lao động."
            );
        };
        try (InputStream input = HrEmploymentContractTemplateProvider.class
                .getResourceAsStream(TEMPLATE_DIRECTORY + fileName)) {
            if (input == null) {
                throw new IllegalStateException("Không tìm thấy mẫu hợp đồng lao động: " + fileName);
            }
            return new TemplateSource(fileName, input.readAllBytes());
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc mẫu hợp đồng lao động: " + fileName, exception);
        }
    }

    public record TemplateSource(String fileName, byte[] bytes) {
    }
}

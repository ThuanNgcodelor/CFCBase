package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrPayrollRowStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "hr_payroll_import_rows", indexes = {
        @Index(name = "idx_hr_payroll_row_import_status", columnList = "import_id, status, source_row_number"),
        @Index(name = "idx_hr_payroll_row_employee_code", columnList = "employee_code")
})
public class HrPayrollImportRow extends HrBaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_payroll_row_import"))
    private HrPayrollImport payrollImport;
    @Column(name = "source_row_number", nullable = false)
    private int sourceRowNumber;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_payroll_row_employee"))
    private HrEmployee employee;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "employee_name", nullable = false)
    private String employeeName;
    @Column(name = "payload_json", nullable = false, columnDefinition = "json")
    private String payloadJson;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrPayrollRowStatus status;
    @Column(name = "telegram_chat_id")
    private Long telegramChatId;
    @Column(name = "telegram_user_id")
    private Long telegramUserId;
    @Column(name = "error_message", length = 1000)
    private String errorMessage;
}

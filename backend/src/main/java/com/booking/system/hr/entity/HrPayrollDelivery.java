package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_payroll_deliveries", indexes = @Index(name = "idx_hr_payroll_delivery_status", columnList = "campaign_id, status, updated_at"))
public class HrPayrollDelivery extends HrBaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_payroll_delivery_campaign"))
    private HrPayrollCampaign campaign;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_row_id", nullable = false, unique = true, foreignKey = @ForeignKey(name = "fk_hr_payroll_delivery_row"))
    private HrPayrollImportRow importRow;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private HrEmployee employee;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "employee_name", nullable = false)
    private String employeeName;
    @Column(name = "telegram_chat_id")
    private Long telegramChatId;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrPayrollDeliveryStatus status;
    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;
    @Column(name = "last_error", length = 1000)
    private String lastError;
    @Column(name = "sent_at")
    private LocalDateTime sentAt;
}

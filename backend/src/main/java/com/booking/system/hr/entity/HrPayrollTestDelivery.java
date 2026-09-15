package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_payroll_test_deliveries")
public class HrPayrollTestDelivery extends HrBaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_row_id", nullable = false)
    private HrPayrollImportRow importRow;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_recipient_id", nullable = false)
    private HrPayrollTestRecipient testRecipient;
    @Column(name = "employee_code", nullable = false, length = 32)
    private String employeeCode;
    @Column(name = "employee_name", nullable = false)
    private String employeeName;
    @Column(name = "message_snapshot", nullable = false, columnDefinition = "TEXT")
    private String messageSnapshot;
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "document_snapshot", columnDefinition = "LONGBLOB")
    private byte[] documentSnapshot;
    @Column(name = "document_file_name", length = 255)
    private String documentFileName;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrPayrollDeliveryStatus status;
    @Column(name = "last_error", length = 1000)
    private String lastError;
    @Column(name = "sent_at")
    private LocalDateTime sentAt;
}

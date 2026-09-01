package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrTelegramRegistrationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_telegram_registrations", indexes = {
        @Index(name = "idx_hr_telegram_registration_status", columnList = "status, created_at"),
        @Index(name = "idx_hr_telegram_registration_user", columnList = "telegram_user_id, status"),
        @Index(name = "idx_hr_telegram_registration_employee", columnList = "employee_id, created_at")
})
public class HrTelegramRegistration extends HrBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", foreignKey = @ForeignKey(name = "fk_hr_telegram_registration_employee"))
    private HrEmployee employee;

    @Column(name = "entered_employee_code", length = 32)
    private String enteredEmployeeCode;

    @Column(name = "phone_number", length = 32)
    private String phoneNumber;

    @Column(name = "telegram_user_id")
    private Long telegramUserId;

    @Column(name = "telegram_chat_id")
    private Long telegramChatId;

    @Column(name = "telegram_username", length = 255)
    private String telegramUsername;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HrTelegramRegistrationStatus status;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "last_attempt_at")
    private LocalDateTime lastAttemptAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by_actor", length = 320)
    private String reviewedByActor;

    @Column(name = "review_note", length = 1000)
    private String reviewNote;
}

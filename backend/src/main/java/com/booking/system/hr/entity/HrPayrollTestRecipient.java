package com.booking.system.hr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_payroll_test_recipients")
public class HrPayrollTestRecipient extends HrBaseEntity {
    @Column(name = "user_id", nullable = false, unique = true, length = 36)
    private String userId;
    @Column(name = "status", nullable = false, length = 16)
    private String status;
    @Column(name = "link_token_hash", unique = true, length = 64)
    private String linkTokenHash;
    @Column(name = "link_expires_at")
    private LocalDateTime linkExpiresAt;
    @Column(name = "telegram_user_id")
    private Long telegramUserId;
    @Column(name = "telegram_chat_id")
    private Long telegramChatId;
    @Column(name = "telegram_username")
    private String telegramUsername;
    @Column(name = "linked_at")
    private LocalDateTime linkedAt;
}

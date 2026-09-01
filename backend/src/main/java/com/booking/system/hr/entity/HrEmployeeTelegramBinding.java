package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrTelegramBindingStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_employee_telegram_bindings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_hr_telegram_binding_employee", columnNames = "employee_id")
}, indexes = {
        @Index(name = "idx_hr_telegram_binding_user_status", columnList = "telegram_user_id, status"),
        @Index(name = "idx_hr_telegram_binding_status", columnList = "status")
})
public class HrEmployeeTelegramBinding extends HrBaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, foreignKey = @ForeignKey(name = "fk_hr_telegram_binding_employee"))
    private HrEmployee employee;

    @Column(name = "telegram_user_id")
    private Long telegramUserId;

    @Column(name = "telegram_chat_id")
    private Long telegramChatId;

    @Column(name = "telegram_username", length = 255)
    private String telegramUsername;

    @Column(name = "phone_number", length = 32)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrTelegramBindingStatus status;

    @Column(name = "linked_at")
    private LocalDateTime linkedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoked_reason", length = 500)
    private String revokedReason;
}

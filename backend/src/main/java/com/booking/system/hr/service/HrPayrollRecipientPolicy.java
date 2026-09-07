package com.booking.system.hr.service;

import com.booking.system.hr.entity.HrEmployeeTelegramBinding;
import com.booking.system.hr.entity.HrPayrollDelivery;
import com.booking.system.hr.enums.HrTelegramBindingStatus;
import java.util.Objects;

/** Re-check the verified recipient immediately before contacting Telegram. */
public final class HrPayrollRecipientPolicy {
    private HrPayrollRecipientPolicy() { }
    public static boolean matches(HrPayrollDelivery delivery, HrEmployeeTelegramBinding binding) {
        return binding != null && binding.getStatus() == HrTelegramBindingStatus.ACTIVE
                && binding.getTelegramChatId() != null && binding.getTelegramUserId() != null
                && Objects.equals(binding.getTelegramChatId(), delivery.getTelegramChatId())
                && delivery.getImportRow() != null
                && Objects.equals(binding.getTelegramUserId(), delivery.getImportRow().getTelegramUserId());
    }
}

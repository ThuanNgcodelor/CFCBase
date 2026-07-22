package com.booking.system.hr.api;

import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import com.booking.system.enums.UserStatus;
import com.booking.system.hr.importer.HrImportActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class HrActorResolver {

    public HrImportActor fromPrincipal(User principal) {
        if (principal == null
                || principal.getId() == null
                || principal.getRole() != RoleEnum.MANAGER
                || principal.getStatus() != UserStatus.ACTIVE) {
            throw new AccessDeniedException("Chỉ tài khoản quản lý đang hoạt động được truy cập phân hệ nhân sự");
        }
        return new HrImportActor(
                "USER:" + principal.getId(),
                principal.getFullName() == null ? principal.getEmail() : principal.getFullName(),
                RoleEnum.MANAGER.name()
        );
    }
}

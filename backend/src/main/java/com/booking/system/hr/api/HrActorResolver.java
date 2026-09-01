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
                || (principal.getRole() != RoleEnum.MANAGER && principal.getRole() != RoleEnum.ADMIN)
                || principal.getStatus() != UserStatus.ACTIVE) {
            throw new AccessDeniedException("Chỉ tài khoản quản lý hoặc quản trị viên đang hoạt động được truy cập phân hệ nhân sự");
        }
        return new HrImportActor(
                "USER:" + principal.getId(),
                principal.getFullName() == null ? principal.getEmail() : principal.getFullName(),
                principal.getRole().name()
        );
    }
}

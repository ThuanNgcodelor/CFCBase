package com.booking.system.config;

import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import com.booking.system.enums.UserStatus;
import com.booking.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        createAdminIfNotExists("admin1@booking.base.vn", "Admin One", "admin123");
        createAdminIfNotExists("admin2@booking.base.vn", "Admin Two", "admin123");
    }

    private void createAdminIfNotExists(String email, String fullName, String password) {
        if (userRepository.findByEmail(email).isEmpty()) {
            User admin = new User();
            admin.setEmail(email);
            admin.setFullName(fullName);
            admin.setPassword(passwordEncoder.encode(password));
            admin.setRole(RoleEnum.ADMIN);
            admin.setStatus(UserStatus.ACTIVE);
            userRepository.save(admin);
            System.out.println("Đã tạo tài khoản admin mẫu: " + email);
        }
    }
}

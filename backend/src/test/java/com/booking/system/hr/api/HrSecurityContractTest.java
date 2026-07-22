package com.booking.system.hr.api;

import com.booking.system.config.SecurityConfig;
import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import com.booking.system.enums.UserStatus;
import com.booking.system.repository.UserRepository;
import com.booking.system.security.JwtAuthFilter;
import com.booking.system.security.JwtUtils;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HrSecurityContractTest {

    private AnnotationConfigWebApplicationContext context;
    private MockMvc mockMvc;
    private JwtUtils jwtUtils;
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(TestWebConfig.class);
        context.refresh();

        jwtUtils = context.getBean(JwtUtils.class);
        userRepository = context.getBean(UserRepository.class);
        Filter securityFilter = context.getBean("springSecurityFilterChain", Filter.class);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).addFilters(securityFilter).build();
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void hrApiReturns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/hr/security-contract"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void hrApiReturns403ForAdminAndEmployee() throws Exception {
        stubToken("admin-token", user("admin@example.test", RoleEnum.ADMIN));
        stubToken("employee-token", user("employee@example.test", RoleEnum.EMPLOYEE));

        mockMvc.perform(get("/api/v1/hr/security-contract")
                        .header("Authorization", "Bearer admin-token"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/hr/security-contract")
                        .header("Authorization", "Bearer employee-token"))
                .andExpect(status().isForbidden());
    }

    @Test
    void hrApiAllowsOnlyManager() throws Exception {
        stubToken("manager-token", user("manager@example.test", RoleEnum.MANAGER));

        mockMvc.perform(get("/api/v1/hr/security-contract")
                        .header("Authorization", "Bearer manager-token"))
                .andExpect(status().isOk());
    }

    private void stubToken(String token, User user) {
        when(jwtUtils.validateJwtToken(token)).thenReturn(true);
        when(jwtUtils.getEmailFromJwtToken(token)).thenReturn(user.getEmail());
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
    }

    private static User user(String email, RoleEnum role) {
        User user = new User();
        user.setId(role.name().toLowerCase() + "-id");
        user.setEmail(email);
        user.setFullName(role.name());
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    @Configuration
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestWebConfig {

        @Bean
        JwtUtils jwtUtils() {
            return mock(JwtUtils.class);
        }

        @Bean
        UserRepository userRepository() {
            return mock(UserRepository.class);
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(JwtUtils jwtUtils, UserRepository userRepository) {
            return new JwtAuthFilter(jwtUtils, userRepository);
        }

        @Bean
        SecurityContractController securityContractController() {
            return new SecurityContractController();
        }
    }

    @RestController
    static class SecurityContractController {

        @GetMapping("/api/v1/hr/security-contract")
        String ping() {
            return "ok";
        }
    }
}

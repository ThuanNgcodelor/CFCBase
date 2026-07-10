package com.booking.system.repository;

import com.booking.system.entity.User;
import com.booking.system.enums.RoleEnum;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    @EntityGraph(attributePaths = "department")
    Optional<User> findByEmail(String email);

    @EntityGraph(attributePaths = "department")
    Optional<User> findById(String id);

    boolean existsByEmail(String email);

    List<User> findByRole(RoleEnum role);
    List<User> findByRoleIn(List<RoleEnum> roles);
}

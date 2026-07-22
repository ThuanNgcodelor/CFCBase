package com.booking.system.hr.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Safe default repository for HR history-bearing data. Delete operations are
 * intentionally absent; future draft cleanup must use explicit guarded methods.
 */
@NoRepositoryBean
public interface HrRepository<T, ID> extends Repository<T, ID> {
    <S extends T> S save(S entity);

    <S extends T> List<S> saveAll(Iterable<S> entities);

    Optional<T> findById(ID id);

    boolean existsById(ID id);

    Page<T> findAll(Pageable pageable);

    long count();
}

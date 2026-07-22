package com.booking.system.hr.entity;

import com.booking.system.hr.enums.HrCatalogStatus;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
public abstract class HrCatalogEntity extends HrBaseEntity {

    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private HrCatalogStatus status = HrCatalogStatus.ACTIVE;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}

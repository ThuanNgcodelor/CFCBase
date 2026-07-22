package com.booking.system.hr.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "hr_departments",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_department_code", columnNames = "code"),
                @UniqueConstraint(name = "uk_hr_department_name", columnNames = "name")
        },
        indexes = @Index(name = "idx_hr_departments_parent", columnList = "parent_id")
)
public class HrDepartment extends HrCatalogEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", foreignKey = @ForeignKey(name = "fk_hr_department_parent"))
    private HrDepartment parent;
}

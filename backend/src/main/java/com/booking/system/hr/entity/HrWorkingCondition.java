package com.booking.system.hr.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "hr_working_conditions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_working_condition_code", columnNames = "code"),
                @UniqueConstraint(name = "uk_hr_working_condition_name", columnNames = "name")
        }
)
public class HrWorkingCondition extends HrCatalogEntity {
}

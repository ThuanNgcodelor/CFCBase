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
        name = "hr_positions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_position_code", columnNames = "code"),
                @UniqueConstraint(name = "uk_hr_position_name", columnNames = "name")
        }
)
public class HrPosition extends HrCatalogEntity {
}

package com.booking.system.hr.entity;

import com.booking.system.hr.enums.*;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "hr_attendance_incidents")
public class HrAttendanceIncident extends HrBaseEntity {
    @Column(name = "incident_type", nullable = false, length = 32) 
    private String incidentType = "DEVICE_OUTAGE";
    @Column(name = "started_at", nullable = false) 
    private LocalDateTime startedAt;
    @Column(name = "ended_at", nullable = false) 
    private LocalDateTime endedAt;
    @Enumerated(EnumType.STRING) @Column(name = "scope_type", nullable = false, length = 32) 
    private HrAttendanceIncidentScopeType scopeType;
    @Column(name = "scope_values_json", nullable = false, columnDefinition = "JSON") 
    private String scopeValuesJson;
    @Column(nullable = false, length = 1000) 
    private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) 
    private HrAttendanceIncidentStatus status;
    @Column(name = "confirmed_at") 
    private LocalDateTime confirmedAt;
    @Column(name = "confirmed_by_actor", length = 320) 
    private String confirmedByActor;
    @Column(name = "cancelled_at") 
    private LocalDateTime cancelledAt;
    @Column(name = "cancelled_by_actor", length = 320) 
    private String cancelledByActor;
}

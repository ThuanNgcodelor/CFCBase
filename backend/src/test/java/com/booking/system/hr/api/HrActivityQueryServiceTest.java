package com.booking.system.hr.api;

import com.booking.system.hr.entity.HrAuditEvent;
import com.booking.system.hr.entity.HrMonthlyRoster;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.repository.HrAuditEventRepository;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrExcelImportBatchRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HrActivityQueryServiceTest {

    @Mock
    private HrEmployeeMovementRepository movementRepository;
    @Mock
    private HrMonthlyRosterRepository rosterRepository;
    @Mock
    private HrMonthlyRosterItemRepository rosterItemRepository;
    @Mock
    private HrAuditEventRepository auditRepository;
    @Mock
    private HrExcelImportBatchRepository importBatchRepository;
    @Mock
    private UserRepository userRepository;

    private HrActivityQueryService service;

    @BeforeEach
    void setUp() {
        service = new HrActivityQueryService(
                movementRepository,
                rosterRepository,
                rosterItemRepository,
                auditRepository,
                importBatchRepository,
                userRepository
        );
    }

    @Test
    void listEndpointsClampPageAndSizeAndReturnStablePageDto() {
        HrAuditEvent event = new HrAuditEvent();
        event.setActorSubject("USER:manager-id");
        event.setActorRole("MANAGER");
        event.setAction("BASELINE_IMPORT_CONFIRMED");
        event.setEntityType("HR_IMPORT_BATCH");
        event.setChangedFields("[\"status\",\"importedRows\"]");
        event.setOccurredAt(LocalDateTime.of(2026, 7, 22, 8, 0));
        when(auditRepository.findAll(any(Pageable.class)))
                .thenAnswer(invocation -> new PageImpl<>(List.of(event), invocation.getArgument(0), 1));

        var response = service.auditEvents(-4, 500);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(auditRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(50);
        assertThat(response.content()).hasSize(1);
        assertThat(response.content().getFirst().action()).isEqualTo("BASELINE_IMPORT_CONFIRMED");
        assertThat(response.content().getFirst().changedFields())
                .isEqualTo("[\"status\",\"importedRows\"]");
    }

    @Test
    void rosterDetailReturnsStableDtoAndMissingRosterReturns404() {
        HrMonthlyRoster roster = new HrMonthlyRoster();
        roster.setId("roster-2026-06");
        roster.setPeriodStart(LocalDate.of(2026, 6, 1));
        roster.setStatus(HrRosterStatus.CLOSED);
        roster.setItemCount(329);
        when(rosterRepository.findById(roster.getId())).thenReturn(Optional.of(roster));

        var response = service.roster(roster.getId());

        assertThat(response.id()).isEqualTo("roster-2026-06");
        assertThat(response.periodStart()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(response.status()).isEqualTo(HrRosterStatus.CLOSED);
        assertThat(response.itemCount()).isEqualTo(329);

        when(rosterRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.roster("missing"))
                .isInstanceOf(HrApiException.class)
                .satisfies(exception -> {
                    HrApiException apiError = (HrApiException) exception;
                    assertThat(apiError.status().value()).isEqualTo(404);
                    assertThat(apiError.code()).isEqualTo("HR_ROSTER_NOT_FOUND");
                });
    }

    @Test
    void rosterItemsReturn404ContractWhenRosterDoesNotExist() {
        when(rosterRepository.existsById("missing")).thenReturn(false);

        assertThatThrownBy(() -> service.rosterItems("missing", 0, 20))
                .isInstanceOf(HrApiException.class)
                .satisfies(exception -> assertThat(((HrApiException) exception).status().value()).isEqualTo(404));
    }
}

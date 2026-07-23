package com.booking.system.hr;

import com.booking.system.config.LegacySchemaFilterProvider;
import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrMovementCreateRequest;
import com.booking.system.hr.entity.HrEmployee;
import com.booking.system.hr.enums.HrEmployeeGender;
import com.booking.system.hr.enums.HrEmploymentStatus;
import com.booking.system.hr.enums.HrMovementType;
import com.booking.system.hr.enums.HrRosterStatus;
import com.booking.system.hr.importer.HrBaselineImportContract;
import com.booking.system.hr.importer.HrBaselineImportPersistence;
import com.booking.system.hr.importer.HrBaselineImportService;
import com.booking.system.hr.importer.HrBaselineWorkbookParser;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.importer.HrImportJsonCodec;
import com.booking.system.hr.repository.HrEmployeeRepository;
import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.hr.service.HrWorkforceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest(properties = {
        "debug=false",
        "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.show_sql=false",
        "logging.level.org.hibernate.SQL=OFF",
        "logging.level.org.springframework.jdbc.core=OFF"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = HrPhase5WorkforceServiceTest.TestApplication.class)
@Import({
        HrBaselineWorkbookParser.class,
        HrBaselineImportContract.class,
        HrImportJsonCodec.class,
        HrBaselineImportPersistence.class,
        HrBaselineImportService.class,
        HrWorkforceService.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class HrPhase5WorkforceServiceTest {

    private static final byte[] WORKBOOK = HrBaselineWorkbookFixture.validWorkbook();
    private static final HrImportActor MANAGER = new HrImportActor(
            "manager@example.test", "Fixture Manager", "MANAGER"
    );

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",
                () -> "jdbc:h2:mem:hr_phase_5_service;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        registry.add("spring.datasource.username", () -> "sa");
        registry.add("spring.datasource.password", () -> "");
        registry.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.baseline-on-migrate", () -> "false");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.jpa.properties.hibernate.hbm2ddl.schema_filter_provider",
                () -> LegacySchemaFilterProvider.class.getName());
        registry.add("spring.jpa.properties.hibernate.jdbc.time_zone", () -> "UTC");
        registry.add("app.hr.baseline.sha256", () -> sha256(WORKBOOK));
        registry.add("app.hr.import.payload-retention-days", () -> "30");
    }

    @jakarta.annotation.Resource private HrBaselineImportService importService;
    @jakarta.annotation.Resource private HrWorkforceService workforceService;
    @jakarta.annotation.Resource private HrEmployeeRepository employeeRepository;
    @jakarta.annotation.Resource private HrEmployeeMovementRepository movementRepository;
    @jakarta.annotation.Resource private HrMonthlyRosterRepository rosterRepository;
    @jakarta.annotation.Resource private HrMonthlyRosterItemRepository rosterItemRepository;
    @jakarta.annotation.Resource private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearHrData() {
        for (String table : new String[]{
                "hr_audit_events", "hr_excel_import_rows", "hr_monthly_roster_items",
                "hr_monthly_rosters", "hr_employee_movements", "hr_employee_contacts",
                "hr_employee_insurance", "hr_employee_identity", "hr_employee_employment",
                "hr_employees", "hr_excel_import_batches", "hr_excel_template_versions",
                "hr_working_conditions", "hr_positions", "hr_departments"
        }) {
            jdbcTemplate.execute("DELETE FROM " + table);
        }
    }

    @Test
    void twelveIncreasesAndTwoDecreasesProduce339WithoutMutatingBaseline() {
        var uploaded = importService.uploadAndParse("baseline-values-2026.xlsx", WORKBOOK, MANAGER);
        importService.validate(uploaded.batchId(), MANAGER);
        importService.confirm(uploaded.batchId(), "phase5-baseline", true, MANAGER);

        var baseline = rosterRepository.findByPeriodStart(LocalDate.of(2026, 6, 1)).orElseThrow();
        assertThat(baseline.getStatus()).isEqualTo(HrRosterStatus.CLOSED);
        assertThat(baseline.getItemCount()).isEqualTo(329);
        assertThat(rosterItemRepository.countByRoster_Id(baseline.getId())).isEqualTo(329);

        for (int index = 1; index <= 12; index++) {
            HrEmployee employee = new HrEmployee();
            employee.setEmployeeCode("P5-ADD-%02d".formatted(index));
            employee.setFullName("Nhân sự tăng " + index);
            employee.setGender(HrEmployeeGender.UNKNOWN);
            employee.setEmploymentStatus(HrEmploymentStatus.DRAFT);
            employee.setCreatedByActor(MANAGER.subject());
            employee.setUpdatedByActor(MANAGER.subject());
            employee = employeeRepository.save(employee);

            var draft = workforceService.createMovement(new HrMovementCreateRequest(
                    employee.getId(), HrMovementType.INCREASE, LocalDate.of(2026, 6, 20),
                    "Bổ sung nhân sự", null, null, "phase5-add-" + index
            ), MANAGER);
            workforceService.confirmMovement(draft.id(), draft.rowVersion(), MANAGER);
        }

        var activeEmployees = employeeRepository.findByEmploymentStatus(
                HrEmploymentStatus.ACTIVE, PageRequest.of(0, 2)).getContent();
        for (int index = 0; index < 2; index++) {
            HrEmployee employee = activeEmployees.get(index);
            var draft = workforceService.createMovement(new HrMovementCreateRequest(
                    employee.getId(), HrMovementType.DECREASE, LocalDate.of(2026, 6, 25),
                    "Ngừng làm việc theo quyết định", "P5-DEC-" + index,
                    LocalDate.of(2026, 6, 24), "phase5-decrease-" + index
            ), MANAGER);
            workforceService.confirmMovement(draft.id(), draft.rowVersion(), MANAGER);
        }

        assertThat(employeeRepository.countByEmploymentStatus(HrEmploymentStatus.ACTIVE)).isEqualTo(339);
        assertThat(employeeRepository.countByEmploymentStatus(HrEmploymentStatus.INACTIVE)).isEqualTo(2);

        var draftRoster = workforceService.createRoster(LocalDate.of(2026, 7, 1), MANAGER);
        assertThat(workforceService.createRoster(LocalDate.of(2026, 7, 1), MANAGER).id())
                .isEqualTo(draftRoster.id());
        var openRoster = workforceService.openRoster(draftRoster.id(), draftRoster.rowVersion(), MANAGER);
        assertThat(openRoster.status()).isEqualTo(HrRosterStatus.OPEN);
        assertThat(openRoster.itemCount()).isEqualTo(339);

        var closedRoster = workforceService.closeRoster(openRoster.id(), openRoster.rowVersion(), MANAGER);
        assertThat(closedRoster.status()).isEqualTo(HrRosterStatus.CLOSED);
        assertThat(closedRoster.itemCount()).isEqualTo(339);
        assertThat(closedRoster.rosterChecksum()).hasSize(64);
        assertThat(rosterItemRepository.countByRoster_Id(closedRoster.id())).isEqualTo(339);

        var unchangedBaseline = rosterRepository.findById(baseline.getId()).orElseThrow();
        assertThat(unchangedBaseline.getStatus()).isEqualTo(HrRosterStatus.CLOSED);
        assertThat(unchangedBaseline.getItemCount()).isEqualTo(329);
        assertThat(rosterItemRepository.countByRoster_Id(baseline.getId())).isEqualTo(329);

        assertThatThrownBy(() -> workforceService.reopenRoster(
                baseline.getId(), unchangedBaseline.getRowVersion(), "Không được phép", MANAGER))
                .isInstanceOf(HrApiException.class)
                .extracting(error -> ((HrApiException) error).code())
                .isEqualTo("BASELINE_ROSTER_IMMUTABLE");

        var reopened = workforceService.reopenRoster(
                closedRoster.id(), closedRoster.rowVersion(), "Bổ sung quyết định muộn", MANAGER);
        assertThat(reopened.status()).isEqualTo(HrRosterStatus.OPEN);
        assertThat(reopened.rosterChecksum()).isNull();

        var reclosed = workforceService.closeRoster(reopened.id(), reopened.rowVersion(), MANAGER);
        var august = workforceService.createRoster(LocalDate.of(2026, 8, 1), MANAGER);
        assertThat(august.status()).isEqualTo(HrRosterStatus.DRAFT);
        assertThatThrownBy(() -> workforceService.reopenRoster(
                reclosed.id(), reclosed.rowVersion(), "Không được sửa kỳ nguồn", MANAGER))
                .isInstanceOf(HrApiException.class)
                .extracting(error -> ((HrApiException) error).code())
                .isEqualTo("ROSTER_HAS_DOWNSTREAM_PERIOD");
    }

    @Test
    void idempotencyAndDraftDeleteGuardsPreserveHistory() {
        HrEmployee employee = new HrEmployee();
        employee.setEmployeeCode("P5-DRAFT-DELETE");
        employee.setFullName("Nhân sự bản nháp");
        employee.setGender(HrEmployeeGender.UNKNOWN);
        employee.setEmploymentStatus(HrEmploymentStatus.DRAFT);
        employee.setCreatedByActor(MANAGER.subject());
        employee.setUpdatedByActor(MANAGER.subject());
        employee = employeeRepository.save(employee);

        HrMovementCreateRequest request = new HrMovementCreateRequest(
                employee.getId(), HrMovementType.INCREASE, LocalDate.of(2026, 7, 20),
                "Bổ sung nhân sự", null, null, "phase5-idempotent-draft"
        );
        var first = workforceService.createMovement(request, MANAGER);
        var replay = workforceService.createMovement(request, MANAGER);

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(movementRepository.countByEmployee_Id(employee.getId())).isEqualTo(1);
        String employeeId = employee.getId();
        assertThatThrownBy(() -> workforceService.deleteDraftEmployee(employeeId, 0L, MANAGER))
                .isInstanceOf(HrApiException.class)
                .extracting(error -> ((HrApiException) error).code())
                .isEqualTo("EMPLOYEE_HAS_REFERENCES");

        workforceService.deleteDraftMovement(first.id(), first.rowVersion(), MANAGER);
        workforceService.deleteDraftEmployee(employeeId, 0L, MANAGER);

        assertThat(movementRepository.countByEmployee_Id(employeeId)).isZero();
        assertThat(employeeRepository.findById(employeeId)).isEmpty();
    }

    @Test
    void futureMovementCannotBeConfirmedAndStaleVersionIsRejected() {
        HrEmployee employee = new HrEmployee();
        employee.setEmployeeCode("P5-FUTURE");
        employee.setFullName("Nhân sự tương lai");
        employee.setGender(HrEmployeeGender.UNKNOWN);
        employee.setEmploymentStatus(HrEmploymentStatus.DRAFT);
        employee.setCreatedByActor(MANAGER.subject());
        employee.setUpdatedByActor(MANAGER.subject());
        employee = employeeRepository.save(employee);

        var draft = workforceService.createMovement(new HrMovementCreateRequest(
                employee.getId(), HrMovementType.INCREASE,
                LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1),
                null, null, null, "phase5-future"
        ), MANAGER);

        assertThatThrownBy(() -> workforceService.confirmMovement(draft.id(), draft.rowVersion(), MANAGER))
                .isInstanceOf(HrApiException.class)
                .extracting(error -> ((HrApiException) error).code())
                .isEqualTo("MOVEMENT_EFFECTIVE_DATE_IN_FUTURE");

        assertThatThrownBy(() -> workforceService.cancelMovement(draft.id(), draft.rowVersion() + 1, MANAGER))
                .isInstanceOf(HrApiException.class)
                .extracting(error -> ((HrApiException) error).code())
                .isEqualTo("STALE_HR_VERSION");
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.booking.system.hr.entity")
    @EnableJpaRepositories(basePackages = "com.booking.system.hr.repository")
    static class TestApplication {
    }
}

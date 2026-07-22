package com.booking.system.hr;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Set;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HrPhase1MigrationTest {

    private static final String MIGRATION = "db/migration/V1__create_hr_phase_1_schema.sql";
    private static final Pattern HR_TABLE_PATTERN = Pattern.compile(
            "(?i)CREATE\\s+TABLE\\s+(hr_[a-z0-9_]+)"
    );

    private static final Set<String> EXPECTED_TABLES = Set.of(
            "hr_departments",
            "hr_positions",
            "hr_working_conditions",
            "hr_employees",
            "hr_employee_employment",
            "hr_employee_identity",
            "hr_employee_insurance",
            "hr_employee_contacts",
            "hr_employee_movements",
            "hr_monthly_rosters",
            "hr_monthly_roster_items",
            "hr_excel_template_versions",
            "hr_excel_import_batches",
            "hr_excel_import_rows",
            "hr_audit_events"
    );

    @Test
    void migrationCreatesOnlyTheLockedHrTableContract() throws IOException {
        String sql = migrationSql();
        Matcher matcher = HR_TABLE_PATTERN.matcher(sql);
        Set<String> actualTables = new java.util.HashSet<>();
        while (matcher.find()) {
            actualTables.add(matcher.group(1).toLowerCase());
        }

        assertThat(actualTables).containsExactlyInAnyOrderElementsOf(EXPECTED_TABLES);
        assertThat(sql).doesNotContain("REFERENCES users", "user_id", "ENUM(");
        assertThat(sql).contains(
                "raw_payload JSON NOT NULL",
                "leave_accrual_start_date DATE NULL",
                "attempt_number INT NOT NULL DEFAULT 1",
                "uk_hr_employee_code",
                "idx_hr_movement_status_date_type",
                "idx_hr_audit_entity"
        );
        assertThat(sql).contains(
                "fk_hr_roster_item_roster FOREIGN KEY (roster_id) REFERENCES hr_monthly_rosters (id) ON DELETE RESTRICT",
                "fk_hr_import_row_batch FOREIGN KEY (batch_id) REFERENCES hr_excel_import_batches (id) ON DELETE RESTRICT"
        );

        String executableSql = sql.replaceAll("(?m)^--.*$", "");
        assertThat(executableSql).doesNotContainPattern("(?i)\\b(ALTER|DROP|DELETE|TRUNCATE)\\s+(TABLE|FROM)?\\s*(users|bookings|rooms|vehicles)");
    }

    @Test
    void trackedFlywayDefaultsRequireExplicitLegacyBaseline() throws IOException {
        Properties properties = new Properties();
        try (InputStream input = HrPhase1MigrationTest.class.getClassLoader()
                .getResourceAsStream("application.properties")) {
            if (input == null) {
                throw new IOException("Missing application.properties");
            }
            properties.load(input);
        }

        assertThat(properties.getProperty("spring.flyway.baseline-on-migrate"))
                .isEqualTo("${FLYWAY_BASELINE_ON_MIGRATE:false}");
        assertThat(properties.getProperty("spring.flyway.baseline-version")).isEqualTo("0");
        assertThat(properties.getProperty("spring.flyway.clean-disabled")).isEqualTo("true");
        assertThat(properties.getProperty("spring.jpa.properties.hibernate.hbm2ddl.schema_filter_provider"))
                .isEqualTo("com.booking.system.config.LegacySchemaFilterProvider");
    }

    @Test
    void migrationRunsOnceAndEnforcesCoreConstraints() throws SQLException {
        String jdbcUrl = "jdbc:h2:mem:hr_phase_1_clean;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        try (Connection anchorConnection = DriverManager.getConnection(jdbcUrl, "sa", "");
             Statement statement = anchorConnection.createStatement()) {
            Flyway flyway = flyway(anchorConnection, false);
            MigrateResult firstRun = flyway.migrate();
            MigrateResult secondRun = flyway.migrate();

            assertThat(firstRun.migrationsExecuted).isEqualTo(1);
            assertThat(secondRun.migrationsExecuted).isZero();

            for (String table : EXPECTED_TABLES) {
                assertThat(tableExists(statement, table)).as(table).isTrue();
            }

            statement.executeUpdate("""
                    INSERT INTO hr_employees (
                        id, employee_code, full_name, created_by_actor, updated_by_actor
                    ) VALUES (
                        'employee-1', 'NV0001', 'Fixture Employee', 'external-actor@example.test', 'external-actor@example.test'
                    )
                    """);

            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO hr_employees (
                        id, employee_code, full_name, created_by_actor, updated_by_actor
                    ) VALUES (
                        'employee-2', 'NV0001', 'Duplicate Employee', 'SYSTEM', 'SYSTEM'
                    )
                    """))
                    .isInstanceOf(SQLException.class);

            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO hr_employees (
                        id, employee_code, full_name, employment_status, created_by_actor, updated_by_actor
                    ) VALUES (
                        'employee-3', 'NV0003', 'Invalid Status', 'UNKNOWN_STATUS', 'SYSTEM', 'SYSTEM'
                    )
                    """))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void baselineOnMigratePreservesExistingBookingBaseData() throws SQLException {
        String jdbcUrl = "jdbc:h2:mem:hr_phase_1_existing;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        try (Connection connection = DriverManager.getConnection(jdbcUrl, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email VARCHAR(320) NOT NULL)");
            statement.executeUpdate("INSERT INTO users (id, email) VALUES ('legacy-user', 'legacy@example.test')");

            MigrateResult result = flyway(connection, true).migrate();
            assertThat(result.migrationsExecuted).isEqualTo(1);

            try (var rows = statement.executeQuery("SELECT id, email FROM users")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString("id")).isEqualTo("legacy-user");
                assertThat(rows.getString("email")).isEqualTo("legacy@example.test");
                assertThat(rows.next()).isFalse();
            }
        }
    }

    private static Flyway flyway(Connection connection, boolean baselineOnMigrate) {
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource(connection, true);
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(baselineOnMigrate)
                .baselineVersion("0")
                .validateOnMigrate(true)
                .cleanDisabled(true)
                .load();
    }

    private static boolean tableExists(Statement statement, String tableName) throws SQLException {
        try (var rows = statement.executeQuery("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '%s'
                """.formatted(tableName))) {
            rows.next();
            return rows.getInt(1) == 1;
        }
    }

    private static String migrationSql() throws IOException {
        ClassLoader classLoader = HrPhase1MigrationTest.class.getClassLoader();
        try (InputStream input = classLoader.getResourceAsStream(MIGRATION)) {
            if (input == null) {
                throw new IOException("Missing migration resource: " + MIGRATION);
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}

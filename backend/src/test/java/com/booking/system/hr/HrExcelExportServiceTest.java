package com.booking.system.hr;

import com.booking.system.hr.repository.HrEmployeeMovementRepository;
import com.booking.system.hr.repository.HrMonthlyRosterItemRepository;
import com.booking.system.hr.repository.HrMonthlyRosterRepository;
import com.booking.system.hr.service.HrExcelExportService;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HrExcelExportServiceTest {

    private final HrMonthlyRosterRepository rosterRepository = mock(HrMonthlyRosterRepository.class);
    private final HrMonthlyRosterItemRepository rosterItemRepository = mock(HrMonthlyRosterItemRepository.class);
    private final HrEmployeeMovementRepository movementRepository = mock(HrEmployeeMovementRepository.class);
    private final HrExcelExportService service = new HrExcelExportService(
            rosterRepository,
            rosterItemRepository,
            movementRepository
    );

    @Test
    void exportMonthCreatesThreeSheets() throws Exception {
        when(rosterRepository.findByPeriodStart(LocalDate.of(2026, 6, 1))).thenReturn(Optional.empty());
        when(movementRepository.findConfirmedForExport(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 6, 1)),
                org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 6, 30))
        )).thenReturn(List.of());

        HrExcelExportService.ExportFile file = service.exportMonth(2026, 6);

        assertThat(file.fileName()).isEqualTo("hr-T6-26.xlsx");
        assertThat(sheetNames(file.content())).containsExactly("TĂNG", "GIẢM", "T6-26");
        assertThat(zipEntry(file.content(), "xl/styles.xml")).isNotBlank();
    }

    @Test
    void exportYearCreatesIncreaseDecreaseAndTwelveMonthSheets() throws Exception {
        when(rosterRepository.findAllByPeriodStartBetweenOrderByPeriodStartAsc(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31)
        )).thenReturn(List.of());
        when(movementRepository.findConfirmedForExport(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 1, 1)),
                org.mockito.ArgumentMatchers.eq(LocalDate.of(2026, 12, 31))
        )).thenReturn(List.of());

        HrExcelExportService.ExportFile file = service.exportYear(2026);

        assertThat(file.fileName()).isEqualTo("hr-nam-2026.xlsx");
        assertThat(sheetNames(file.content())).containsExactly(
                "TĂNG", "GIẢM",
                "T1-26", "T2-26", "T3-26", "T4-26", "T5-26", "T6-26",
                "T7-26", "T8-26", "T9-26", "T10-26", "T11-26", "T12-26"
        );
        assertThat(zipEntry(file.content(), "xl/worksheets/sheet14.xml")).isNotBlank();
    }

    private static List<String> sheetNames(byte[] workbook) throws Exception {
        String workbookXml = zipEntry(workbook, "xl/workbook.xml");
        assertThat(workbookXml).isNotBlank();
        return java.util.regex.Pattern.compile("<sheet name=\"([^\"]+)\"")
                .matcher(workbookXml)
                .results()
                .map(match -> match.group(1))
                .toList();
    }

    private static String zipEntry(byte[] workbook, String name) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(workbook), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (name.equals(entry.getName())) {
                    return new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        }
        return null;
    }
}

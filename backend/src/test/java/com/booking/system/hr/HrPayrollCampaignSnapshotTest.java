package com.booking.system.hr;

import com.booking.system.hr.api.dto.HrPayrollDtos;
import com.booking.system.hr.entity.*;
import com.booking.system.hr.enums.*;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.*;
import com.booking.system.hr.service.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class HrPayrollCampaignSnapshotTest {
    final HrPayrollCampaignRepository campaigns = mock(HrPayrollCampaignRepository.class);
    final HrPayrollDeliveryRepository deliveries = mock(HrPayrollDeliveryRepository.class);
    final HrPayrollImportRepository imports = mock(HrPayrollImportRepository.class);
    final HrPayrollImportRowRepository rows = mock(HrPayrollImportRowRepository.class);
    final TelegramBotClient bot = mock(TelegramBotClient.class);
    final HrPayrollCampaignService service = new HrPayrollCampaignService(campaigns, deliveries, imports, rows, bot,
            mock(HrEmployeeTelegramBindingRepository.class), mock(TransactionTemplate.class));
    @Test void createsFrozenMessageAndPreviewCannotReadAnotherCampaign() {
        var batch = new HrPayrollImport(); batch.setId("import-1"); batch.setPayrollMonth("2026-07"); batch.setSourceFileName("fixture.xlsx");
        when(imports.findByIdForUpdate("import-1")).thenReturn(Optional.of(batch));
        var row = new HrPayrollImportRow(); row.setEmployeeCode("TEST"); row.setEmployeeName("Test User");
        row.setStatus(HrPayrollRowStatus.READY); row.setTelegramChatId(123L);
        row.setPayloadJson("{\"nganHangChuyen\":12000000,\"cong\":22}");
        when(rows.findByPayrollImportIdOrderBySourceRowNumber("import-1")).thenReturn(List.of(row));
        when(campaigns.save(any())).thenAnswer(i -> { HrPayrollCampaign c=i.getArgument(0); c.setId("campaign-1"); return c; });
        service.create("import-1",new HrPayrollDtos.CreateCampaignRequest("TEXT"),new HrImportActor("hr", "HR", "ADMIN"));
        var captor=ArgumentCaptor.forClass(HrPayrollDelivery.class); verify(deliveries).save(captor.capture());
        var delivery=captor.getValue();
        assertThat(delivery.getMessageSnapshot()).contains("Test User", "12.000.000 đ", "2026-07");
        row.setPayloadJson("{}");
        when(deliveries.findById("d1")).thenReturn(Optional.of(delivery));
        assertThat(service.previewMessage("campaign-1","d1")).contains("12.000.000 đ");
        assertThatThrownBy(() -> service.previewMessage("other","d1")).hasMessageContaining("Không tìm thấy");
        verifyNoInteractions(bot);
    }
    @Test void uncertainFailuresCannotBeRetriedAutomaticallyOrThroughRetryButton() {
        var campaign=new HrPayrollCampaign(); campaign.setStatus(HrPayrollCampaignStatus.COMPLETED_WITH_WARNING);
        when(campaigns.findByIdForUpdate("c")).thenReturn(Optional.of(campaign));
        var delivery=new HrPayrollDelivery(); delivery.setLastError("UNCERTAIN: Timeout");
        when(deliveries.findByCampaignIdAndStatus("c",HrPayrollDeliveryStatus.FAILED)).thenReturn(List.of(delivery));
        assertThatThrownBy(() -> service.retryFailed("c",new HrImportActor("hr","HR","ADMIN"))).hasMessageContaining("đối soát");
        verify(deliveries,never()).save(any()); verifyNoInteractions(bot);
    }
    @Test void onlyPreviewImportWithoutCampaignCanBeDeleted() {
        var preview = new HrPayrollImport(); preview.setStatus(HrPayrollImportStatus.PREVIEWED);
        when(imports.findByIdForUpdate("preview")).thenReturn(Optional.of(preview));
        when(campaigns.findByPayrollImportId("preview")).thenReturn(Optional.empty());
        service.deletePreviewImport("preview");
        verify(imports).deleteById("preview");

        var protectedImport = new HrPayrollImport(); protectedImport.setStatus(HrPayrollImportStatus.PREVIEWED);
        when(imports.findByIdForUpdate("protected")).thenReturn(Optional.of(protectedImport));
        when(campaigns.findByPayrollImportId("protected")).thenReturn(Optional.of(new HrPayrollCampaign()));
        assertThatThrownBy(() -> service.deletePreviewImport("protected"))
                .hasMessageContaining("đã tạo đợt gửi");
        verify(imports, never()).deleteById("protected");
    }
}
